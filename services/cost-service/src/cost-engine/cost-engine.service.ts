import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Apu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { Supply } from '../entities/supply.entity';
import { SupplyPrice } from '../entities/supply-price.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Project } from '../entities/project.entity';
import { Chapter } from '../entities/chapter.entity';
import {
  moneyAdd,
  moneySub,
  moneyPercent,
  fromCents,
  toCents,
  parseCantidad,
  Dinero,
} from '../common/money';

export interface Aviso {
  tipo: 'INFO' | 'ADVERTENCIA' | 'ERROR';
  codigo: string;
  mensaje: string;
  field?: string;
}

interface ComponenteCalculado {
  insumo_id: string;
  descripcion: string;
  unidad: string;
  grupo: string;
  rendimiento: string;
  valor: Dinero;
  subtotal: Dinero;
}

/** Motor de cálculo en cascada del presupuesto (CostPro). */
@Injectable()
export class CostEngine {
  constructor(
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(ApuComponent) private readonly apuComponentRepo: Repository<ApuComponent>,
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(SupplyPrice) private readonly priceRepo: Repository<SupplyPrice>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(Chapter) private readonly chapterRepo: Repository<Chapter>,
  ) {}

  /**
   * Precio vigente de un insumo: el registro con vigente_desde <= fecha más
   * reciente. Si ninguno está vigente, toma el más reciente y lo marca como
   * histórico (para aviso blando).
   */
  async precioVigente(insumoId: string, fecha: Date = new Date()): Promise<{
    valor: Dinero;
    fechaPrecio: Date | null;
    historico: boolean;
    existe: boolean;
  }> {
    const row = await this.priceRepo
      .createQueryBuilder('p')
      .where('p.supply_id = :id', { id: insumoId })
      .andWhere('p.vigente_desde <= :fecha', { fecha })
      .orderBy('p.vigente_desde', 'DESC')
      .getOne();

    if (row) {
      return { valor: row.valor, fechaPrecio: row.vigente_desde, historico: false, existe: true };
    }

    const historico = await this.priceRepo
      .createQueryBuilder('p')
      .where('p.supply_id = :id', { id: insumoId })
      .orderBy('p.vigente_desde', 'DESC')
      .getOne();

    if (historico) {
      return { valor: historico.valor, fechaPrecio: historico.vigente_desde, historico: true, existe: true };
    }

    return { valor: '0.00', fechaPrecio: null, historico: false, existe: false };
  }

  /**
   * Costo directo unitario de un APU a partir de sus componentes y el precio
   * vigente de cada insumo: Σ (rendimiento × precio_vigente).
   */
  async costoApu(apuId: string, fecha?: Date): Promise<{
    costo_unitario: Dinero;
    componentes: ComponenteCalculado[];
    avisos: Aviso[];
  }> {
    const apu = await this.apuRepo.findOne({ where: { id: apuId, deleted_at: null } });
    if (!apu) throw new NotFoundException('APU no encontrado');

    const componentes = await this.apuComponentRepo.find({ where: { apu_id: apuId } });
    const supplyIds = [...new Set(componentes.map((c) => c.insumo_id))];
    const insumos = supplyIds.length ? await this.supplyRepo.findByIds(supplyIds) : [];

    const detalle: ComponenteCalculado[] = [];
    const avisos: Aviso[] = [];
    let total = 0;

    for (const comp of componentes) {
      const insumo = insumos.find((s) => s.id === comp.insumo_id);
      if (!insumo) {
        avisos.push({
          tipo: 'ERROR',
          codigo: 'INSUMO_BORRADO',
          mensaje: `Un insumo del APU ${apu.codigo} ya no existe`,
          field: `componentes.${comp.insumo_id}`,
        });
        continue;
      }

      const precio = await this.precioVigente(comp.insumo_id, fecha);
      const subtotal = Math.round(toCents(precio.valor) * parseCantidad(comp.rendimiento)) / 100;
      total += toCents(fromCents(Math.round(toCents(precio.valor) * parseCantidad(comp.rendimiento) * 100) / 100));

      if (!precio.existe) {
        avisos.push({
          tipo: 'ADVERTENCIA',
          codigo: 'INSUMO_SIN_PRECIO',
          mensaje: `El insumo "${insumo.descripcion}" no tiene precio; se usa 0.00`,
          field: `componentes.${insumo.id}.precio`,
        });
      } else if (precio.historico) {
        avisos.push({
          tipo: 'ADVERTENCIA',
          codigo: 'PRECIO_HISTORICO',
          mensaje: `El insumo "${insumo.descripcion}" usa un precio histórico`,
          field: `componentes.${insumo.id}.precio`,
        });
      }

      detalle.push({
        insumo_id: insumo.id,
        descripcion: insumo.descripcion,
        unidad: insumo.unidad,
        grupo: insumo.grupo,
        rendimiento: comp.rendimiento,
        valor: precio.valor,
        subtotal: fromCents(subtotal),
      });
    }

    return { costo_unitario: fromCents(total), componentes: detalle, avisos };
  }

  /**
   * Costo de una propuesta de componentes (para impacto de edición de APU).
   * Igual que costoApu pero en lugar de leer de BD usa la entrada propuesta.
   */
  async costoDeComponentes(
    componentes: Array<{ insumo_id: string; rendimiento: number }>,
    fecha?: Date,
  ): Promise<{ costo_unitario: Dinero; avisos: Aviso[] }> {
    const ids = [...new Set(componentes.map((c) => c.insumo_id))];
    const insumos = ids.length ? await this.supplyRepo.findByIds(ids) : [];
    const avisos: Aviso[] = [];
    let total = 0;

    for (const comp of componentes) {
      const insumo = insumos.find((s) => s.id === comp.insumo_id);
      if (!insumo) {
        avisos.push({
          tipo: 'ERROR',
          codigo: 'INSUMO_INVALIDO',
          mensaje: 'La propuesta incluye un insumo que no existe',
        });
        continue;
      }
      const precio = await this.precioVigente(comp.insumo_id, fecha);
      const subtotal = Math.round(toCents(precio.valor) * parseCantidad(comp.rendimiento)) / 100;
      total += toCents(fromCents(Math.round(toCents(precio.valor) * parseCantidad(comp.rendimiento) * 100) / 100));
      if (!precio.existe) {
        avisos.push({
          tipo: 'ADVERTENCIA',
          codigo: 'INSUMO_SIN_PRECIO',
          mensaje: `El insumo "${insumo.descripcion}" no tiene precio; se usa 0.00`,
        });
      }
    }
    return { costo_unitario: fromCents(total), avisos };
  }

  /**
   * Desglose maestro de un proyecto: items, subtotales por capítulo, costo
   * directo, AIU, IVA y total. Cálculo siempre desde los snapshots congelados.
   */
  async calcularProyecto(project: Project): Promise<{
    items: Array<{
      item_id: string;
      chapter_id: string | null;
      chapter_nombre: string | null;
      descripcion: string;
      unidad: string;
      cantidad: string;
      valor_unitario: Dinero;
      subtotal: Dinero;
    }>;
    capitulos: Array<{ chapter_id: string | null; nombre: string | null; subtotal: Dinero }>;
    costo_directo: Dinero;
    aiu_desglose: {
      administracion: Dinero;
      imprevistos: Dinero;
      utilidad: Dinero;
      subtotal_aiu: Dinero;
      descuento: Dinero;
    };
    iva: Dinero;
    total: Dinero;
  }> {
    const items = await this.itemRepo.find({
      where: { project_id: project.id, deleted_at: null },
      order: { created_at: 'ASC' },
    });
    const chapters = await this.chapterRepo.find({
      where: { shop_id: project.shop_id },
      order: { orden: 'ASC', nombre: 'ASC' },
    });
    const chapterMap = new Map(chapters.map((c) => [c.id, c]));

    const rows: Array<{
      item_id: string;
      chapter_id: string | null;
      chapter_nombre: string | null;
      descripcion: string;
      unidad: string;
      cantidad: string;
      valor_unitario: Dinero;
      subtotal: Dinero;
    }> = [];
    const capituloTotals = new Map<string, number>();
    let costoDirecto = 0;

    for (const item of items) {
      const cantidad = parseCantidad(item.cantidad);
      const valorUnitario = item.valor_unitario && item.valor_unitario !== '0'
        ? item.valor_unitario
        : (item.apu_snapshot?.valor_unitario ?? '0.00');
      const subtotalCents = Math.round(cantidad * toCents(valorUnitario));
      const ch = item.chapter_id ? chapterMap.get(item.chapter_id) : null;

      costoDirecto += subtotalCents;
      const key = item.chapter_id ?? 'SIN_CAPITULO';
      capituloTotals.set(key, (capituloTotals.get(key) ?? 0) + subtotalCents);

      rows.push({
        item_id: item.id,
        chapter_id: item.chapter_id,
        chapter_nombre: ch?.nombre ?? null,
        descripcion: item.descripcion,
        unidad: item.unidad,
        cantidad: item.cantidad,
        valor_unitario: valorUnitario,
        subtotal: fromCents(subtotalCents),
      });
    }

    const costoDT = fromCents(costoDirecto);
    const aiu = (project.aiu ?? {}) as NonNullable<Project['aiu']>;
    const pctAdm = Number(aiu.pctAdministracion ?? 0);
    const pctImp = Number(aiu.pctImprevistos ?? 0);
    const pctUt = Number(aiu.pctUtilidad ?? 0);
    const pctIva = Number(aiu.pctIva ?? 0);
    const descuentoPct = Number(aiu.descuento ?? 0);
    const ivaAplica = Boolean(aiu.ivaAplica ?? true);
    const baseIva = aiu.baseIva ?? 'TOTAL';

    const adm = moneyPercent(costoDT, pctAdm);
    const imp = moneyPercent(costoDT, pctImp);
    const ut = moneyPercent(costoDT, pctUt);
    const subtotalAiu = moneyAdd(moneyAdd(adm, imp), ut);
    const indirectado = moneyAdd(costoDT, subtotalAiu);

    const descuento = moneyPercent(indirectado, descuentoPct);
    let base = moneySub(indirectado, descuento);

    if (baseIva === 'UTILIDAD') {
      base = moneyAdd(base, ut);
    }
    const iva = ivaAplica ? moneyPercent(base, pctIva) : '0.00';
    const total = moneyAdd(base, iva);

    const capitulos = Array.from(capituloTotals.entries())
      .map(([id, cents]) => {
        const chapter = id === 'SIN_CAPITULO' ? null : chapterMap.get(id);
        return {
          chapter_id: id === 'SIN_CAPITULO' ? null : id,
          nombre: id === 'SIN_CAPITULO' ? 'Sin capítulo' : chapter?.nombre ?? null,
          subtotal: fromCents(cents),
        };
      })
      .sort((a, b) => (a.chapter_id === null ? 1 : 0) - (b.chapter_id === null ? 1 : 0));

    return {
      items: rows,
      capitulos,
      costo_directo: costoDT,
    aiu_desglose: {
      administracion: adm,
      imprevistos: imp,
      utilidad: ut,
      subtotal_aiu: subtotalAiu,
      descuento,
    },
      iva,
      total,
    };
  }

  /** Subtotal de un item = cantidad × valor_unitario. */
  subtotalItem(item: Pick<BudgetItem, 'cantidad' | 'valor_unitario'>): Dinero {
    const cantidad = parseCantidad(item.cantidad);
    const valor = toCents(item.valor_unitario ?? '0.00');
    return fromCents(Math.round(cantidad * valor));
  }
}