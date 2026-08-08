import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Project } from '../entities/project.entity';
import { Apu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { Supply } from '../entities/supply.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { BudgetEvent } from '../entities/budget-event.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { fromCents, toCents } from '../common/money';
import { AplicarPlantillaDto } from './templates.dto';

interface ActivityTemplate {
  apuCodigo: string;
  cantidad: number;
}

interface Plantilla {
  id: string;
  codigo: string;
  nombre: string;
  alcance: string;
  areaReferencia: number;
  actividades: ActivityTemplate[];
}

/**
 * Catálogo de plantillas precargadas (HU-02). El valor de referencia se
 * recalcula con los precios vigentes de la tienda al momento de listar.
 */
const PLANTILLAS: Plantilla[] = [
  {
    id: 'tpl_remod80',
    codigo: 'REMOD',
    nombre: 'Remodelación 80 m²',
    alcance: 'Obra de tratamiento liviano: pañetes, pintura, pisos y cerchas.',
    areaReferencia: 80,
    actividades: [
      { apuCodigo: 'PL', cantidad: 1 },
      { apuCodigo: 'PANET', cantidad: 100 },
      { apuCodigo: 'PINT', cantidad: 200 },
      { apuCodigo: 'PISO', cantidad: 60 },
    ],
  },
  {
    id: 'tpl_obranueva',
    codigo: 'OBRA',
    nombre: 'Obra nueva 100 m²',
    alcance: 'Estructura, pañetes y acabados para una casa de una planta.',
    areaReferencia: 100,
    actividades: [
      { apuCodigo: 'CONCRETO', cantidad: 40 },
      { apuCodigo: 'PANET', cantidad: 300 },
      { apuCodigo: 'PINT', cantidad: 400 },
      { apuCodigo: 'PISO', cantidad: 100 },
    ],
  },
  {
    id: 'tpl_remod50',
    codigo: 'REMO-L',
    nombre: 'Adecuación local 50 m²',
    alcance: 'Adecuación comercial: paños, pintura y piso porcelanato.',
    areaReferencia: 50,
    actividades: [
      { apuCodigo: 'PANET', cantidad: 120 },
      { apuCodigo: 'PINT', cantidad: 180 },
      { apuCodigo: 'PISO', cantidad: 50 },
    ],
  },
];

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(ApuComponent) private readonly compRepo: Repository<ApuComponent>,
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(BudgetEvent) private readonly eventRepo: Repository<BudgetEvent>,
    private readonly costEngine: CostEngine,
  ) {}

  /** Lista plantillas con valor de referencia recalculado con precios vigentes. */
  async listar(shopId: string) {
    const datos: Array<{
      id: string;
      codigo: string;
      nombre: string;
      alcance: string;
      area_referencia: number;
      valor_referencia: string;
      actividades: number;
    }> = [];

    for (const t of PLANTILLAS) {
      const apusDePlantilla = await this.apuRepo.find({
        where: { shop_id: shopId, codigo: In(t.actividades.map((a) => a.apuCodigo)), deleted_at: null },
      });
      if (apusDePlantilla.length === 0) continue;

      const map = new Map(apusDePlantilla.map((a) => [a.codigo, a]));
      let valor = 0;
      for (const act of t.actividades) {
        const apu = map.get(act.apuCodigo);
        if (!apu) continue;
        const costo = await this.costEngine.costoApu(apu.id);
        valor += toCents(costo.costo_unitario) * act.cantidad;
      }

      datos.push({
        id: t.id,
        codigo: t.codigo,
        nombre: t.nombre,
        alcance: t.alcance,
        area_referencia: t.areaReferencia,
        valor_referencia: fromCents(Math.round(valor)),
        actividades: t.actividades.length,
      });
    }
    return datos;
  }

  /**
   * Aplica una plantilla al presupuesto (HU-02). Operación atómica: si ya hay
   * contenido, el modo es obligatorio (REEMPLAZAR o AGREGAR).
   */
  async aplicar(
    shopId: string,
    customerId: string,
    projectId: string,
    dto: AplicarPlantillaDto,
    usuario?: string,
  ) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId, shop_id: shopId, customer_id: customerId, deleted_at: null },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const plantilla = PLANTILLAS.find((t) => t.id === dto.templateId);
    if (!plantilla) {
      throw new BadRequestException({
        error: 'PLANTILLA_INEXISTENTE',
        mensaje: 'No existe la plantilla solicitada',
      });
    }

    const itemsActivos = await this.itemRepo.find({
      where: { project_id: project.id, deleted_at: null },
    });

    if (itemsActivos.length > 0 && !dto.modo) {
      throw new BadRequestException({
        error: 'MODO_REQUERIDO',
        mensaje: 'El proyecto ya tiene contenido; indique modo REEMPLAZAR o AGREGAR',
      });
    }

    const antes = await this.snapState(project.id);

    // Modo REEMPLAZAR: marca como eliminados los items actuales.
    if (dto.modo === 'REEMPLAZAR') {
      for (const it of itemsActivos) {
        it.deleted_at = new Date();
        await this.itemRepo.save(it);
      }
    }

    const omitidas: Array<{ apu_id: string; motivo: string }> = [];
    const cargados: Array<{ item_id: string; apu_id: string }> = [];

    for (const act of plantilla.actividades) {
      const apu = await this.apuRepo.findOne({
        where: { shop_id: shopId, codigo: act.apuCodigo, deleted_at: null },
      });
      if (!apu) {
        omitidas.push({ apu_id: act.apuCodigo, motivo: 'APU_NO_EXISTE' });
        continue;
      }

      const componentes = await this.compRepo.find({ where: { apu_id: apu.id } });
      const insumos = await this.supplyRepo.findByIds(componentes.map((c) => c.insumo_id));

      const snapshotComponentes = [];
      let costo = 0;

      for (const comp of componentes) {
        const insumo = insumos.find((s) => s.id === comp.insumo_id);
        const precio = await this.costEngine.precioVigente(comp.insumo_id);
        const subtotalCents = Math.round(toCents(precio.valor) * parseFloat(comp.rendimiento));
        costo += subtotalCents;
        snapshotComponentes.push({
          insumo_id: comp.insumo_id,
          descripcion: insumo?.descripcion ?? '',
          unidad: insumo?.unidad ?? '',
          grupo: insumo?.grupo ?? '',
          rendimiento: comp.rendimiento,
          valor: precio.valor,
          subtotal: fromCents(subtotalCents),
        });
      }

      const valorUnitario = fromCents(costo);

      const item = this.itemRepo.create({
        project_id: project.id,
        chapter_id: null,
        apu_id: apu.id,
        apu_snapshot: {
          apu_id: apu.id,
          codigo: apu.codigo,
          descripcion: apu.descripcion,
          unidad: apu.unidad,
          valor_unitario: valorUnitario,
          componentes: snapshotComponentes,
          version: apu.version,
          capturado_en: new Date().toISOString(),
        },
        descripcion: apu.descripcion,
        unidad: apu.unidad,
        cantidad: String(act.cantidad),
        valor_unitario: valorUnitario,
      });
      const saved = await this.itemRepo.save(item);
      cargados.push({ item_id: saved.id, apu_id: apu.id });
    }

    const despues = await this.snapState(project.id);
    const evento = this.eventRepo.create({
      project_id: project.id,
      tipo: 'TEMPLATE_APPLY',
      undo_token: randomUUID(),
      estado_antes: antes,
      estado_despues: despues,
      usuario: usuario ?? null,
    });
    await this.eventRepo.save(evento);

    const totales = await this.costEngine.calcularProyecto(project);

    return {
      actividades_cargadas: cargados.length,
      cargadas: cargados,
      actividades_omitidas: omitidas,
      totales: {
        costo_directo: totales.costo_directo,
        aiu: totales.aiu_desglose.subtotal_aiu,
        iva: totales.iva,
        descuento: totales.aiu_desglose.descuento,
        total: totales.total,
      },
      undo_token: evento.undo_token,
    };
  }

  private async snapState(projectId: string) {
    const items = await this.itemRepo.find({ where: { project_id: projectId } });
    return {
      items: items.map((i) => ({
        id: i.id,
        chapter_id: i.chapter_id,
        apu_id: i.apu_id,
        descripcion: i.descripcion,
        unidad: i.unidad,
        cantidad: i.cantidad,
        valor_unitario: i.valor_unitario,
        deleted_at: i.deleted_at?.toISOString() ?? null,
      })),
    };
  }
}