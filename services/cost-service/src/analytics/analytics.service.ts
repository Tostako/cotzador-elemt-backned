import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Project, EstadoProyecto } from '../entities/project.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Apu } from '../entities/apu.entity';
import { Supply, GrupoInsumo } from '../entities/supply.entity';
import { Chapter } from '../entities/chapter.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { fromCents, toCents, parseCantidad } from '../common/money';

type GrupoReq = 'MATERIAL' | 'MANO_OBRA' | 'EQUIPO' | 'TRANSPORTE';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(Chapter) private readonly chapterRepo: Repository<Chapter>,
    private readonly costEngine: CostEngine,
  ) {}

  private async obtenerProyecto(shopId: string, customerId: string, projectId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId, shop_id: shopId, customer_id: customerId, deleted_at: null },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  private etagDe(project: Project, itemsLength: number) {
    const etag = `${project.version}-${itemsLength}-${project.updated_at.toISOString()}`;
    return `"${Buffer.from(etag).toString('base64')}"`;
  }

  /** Resumen del panel: costos, AIU e IVA. Recalcado al vuelo. */
  async resumen(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const calculo = await this.costEngine.calcularProyecto(project);
    const itemsCount = calculo.items.length;

    return {
      project: {
        id: project.id,
        nombre: project.nombre,
        estado: project.estado,
        version: project.version,
      },
      costo_directo: calculo.costo_directo,
      aiu_desglose: calculo.aiu_desglose,
      iva: calculo.iva,
      total: calculo.total,
      capitulos: calculo.capitulos,
      items_count: itemsCount,
      computed_at: new Date().toISOString(),
      etag: this.etagDe(project, itemsCount),
    };
  }

  /** Etag solo para validar If-None-Match sin recalcular. */
  async etagActual(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const items = await this.itemRepo.count({ where: { project_id: project.id, deleted_at: null } });
    return this.etagDe(project, items);
  }

  /** Distribución por capítulos. */
  async porCapitulos(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const calculo = await this.costEngine.calcularProyecto(project);
    return calculo.capitulos;
  }

  // ---- Fase 2: consolidados (HU-19) -------------------------------------

  /**
   * Recorre las actividades, agrega por insumo usando el snapshot congelado y
   * multiplica por la cantidad de cada item. Acepta grupo MATERIAL, MANO_OBRA,
   * EQUIPO o TRANSPORTE.
   */
  async consolidado(shopId: string, customerId: string, projectId: string, grupo: GrupoReq) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const items = await this.itemRepo.find({
      where: { project_id: project.id, deleted_at: null },
    });

    const acc = new Map<
      string,
      { insumoId: string; descripcion: string; unidad: string; cantidadTotal: number; valor: number }
    >();

    for (const item of items) {
      const cantidad = parseCantidad(item.cantidad);
      const componentes = item.apu_snapshot?.componentes ?? [];
      for (const c of componentes) {
        if (c.grupo !== grupo) continue;
        const valorCents = toCents(c.subtotal ?? '0.00');
        const exist = acc.get(c.insumo_id);
        if (exist) {
          exist.cantidadTotal += parseCantidad(c.rendimiento) * cantidad;
          exist.valor += valorCents * cantidad;
        } else {
          acc.set(c.insumo_id, {
            insumoId: c.insumo_id,
            descripcion: c.descripcion,
            unidad: c.unidad,
            cantidadTotal: parseCantidad(c.rendimiento) * cantidad,
            valor: valorCents * cantidad,
          });
        }
      }
    }

    const data = Array.from(acc.values())
      .map((r) => ({
        insumo_id: r.insumoId,
        descripcion: r.descripcion,
        unidad: r.unidad,
        cantidad_total: r.cantidadTotal.toFixed(4),
        valor_unitario: fromCents(Math.round(r.valor / Math.max(r.cantidadTotal, 1))), // ver nota
        valor_total: fromCents(r.valor),
      }))
      .sort((a, b) => toCents(a.valor_total) - toCents(b.valor_total));

    return {
      computed_at: new Date().toISOString(),
      total: fromCents(data.reduce((s, d) => s + toCents(d.valor_total), 0)),
      data,
    };
  }

  // ---- Fase 2: inteligencia de costos (HU-18) ---------------------------

  /** Costo por m² y composición del gasto por grupo de recurso. */
  async costIntelligence(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const calculo = await this.costEngine.calcularProyecto(project);
    const area = parseCantidad(project.area_m2);

    // Agregar por grupo desde los snapshots.
    const items = await this.itemRepo.find({ where: { project_id: project.id, deleted_at: null } });
    const grupos = new Map<string, number>();
    for (const item of items) {
      const cantidad = parseCantidad(item.cantidad);
      for (const c of item.apu_snapshot?.componentes ?? []) {
        const g = c.grupo as GrupoInsumo;
        const valor = toCents(c.subtotal ?? '0.00') * cantidad;
        grupos.set(g, (grupos.get(g) ?? 0) + valor);
      }
    }

    const totalDirecto = toCents(calculo.costo_directo) || 1;
    const recursos = (['MATERIAL', 'MANO_OBRA', 'EQUIPO', 'TRANSPORTE'] as const).map((tipo) => {
      const valor = grupos.get(tipo) ?? 0;
      return {
        tipo,
        valor: fromCents(valor),
        pct: Math.round((valor / totalDirecto) * 10000) / 100,
        por_m2: area > 0 ? fromCents(valor / area) : null,
      };
    });

    return {
      computed_at: new Date().toISOString(),
      area_m2: project.area_m2,
      costo_directo: calculo.costo_directo,
      total: calculo.total,
      costo_directo_por_m2: area > 0 ? fromCents(toCents(calculo.costo_directo) / area) : null,
      recursos,
    };
  }

  /** Franja de avisos accionables (HU-18, decisión H-16). */
  async alerts(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const items = await this.itemRepo.find({ where: { project_id: project.id, deleted_at: null } });
    const apus = items.length
      ? await this.apuRepo.find({ where: { id: In(items.map((i) => i.apu_id!).filter(Boolean)) } })
      : [];

    const avisos: Array<{
      codigo: string;
      mensaje: string;
      severidad: 'INFO' | 'ADVERTENCIA' | 'ERROR';
      recurso?: { tipo: string; id: string };
    }> = [];

    if (items.length === 0) {
      avisos.push({
        codigo: 'PRESUPUESTO_VACIO',
        mensaje: 'El presupuesto no tiene actividades',
        severidad: 'ADVERTENCIA',
      });
    }

    // Precios desactualizados de snapshot vs catálogo.
    const apuMap = new Map(apus.map((a) => [a.id, a]));
    for (const item of items) {
      const apu = item.apu_id ? apuMap.get(item.apu_id) : null;
      if (!apu) continue;
      const catalogo = await this.costEngine.costoApu(apu.id);
      if (catalogo.costo_unitario !== item.apu_snapshot?.valor_unitario) {
        const diverge = parseFloat(catalogo.costo_unitario) !== parseFloat(item.valor_unitario ?? '0');
        if (diverge) {
          avisos.push({
            codigo: 'PRECIO_DESACTUALIZADO',
            mensaje: `El APU "${item.descripcion}" cambió en el catálogo`,
            severidad: 'ADVERTENCIA',
            recurso: { tipo: 'ACTIVIDAD', id: item.id },
          });
        }
      }
    }

    // APU incompleto: cantidad atípica.
    for (const item of items) {
      if (parseFloat(item.cantidad) <= 0) {
        avisos.push({
          codigo: 'CANTIDAD_ATIPICA',
          mensaje: `"${item.descripcion}" tiene cantidad inválida`,
          severidad: 'ADVERTENCIA',
          recurso: { tipo: 'ACTIVIDAD', id: item.id },
        });
      }
      const incompletos = (item.apu_snapshot?.componentes ?? []).filter((c) => Number(c.valor ?? 0) <= 0);
      if (incompletos.length) {
        avisos.push({
          codigo: 'APU_INCOMPLETO',
          mensaje: `"${item.descripcion}" tiene ${incompletos.length} insumo(s) sin precio`,
          severidad: 'ERROR',
          recurso: { tipo: 'ACTIVIDAD', id: item.id },
        });
      }
    }

    return { data: avisos, computed_at: new Date().toISOString() };
  }
}