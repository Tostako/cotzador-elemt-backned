import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Supply } from '../entities/supply.entity';
import { SupplyPrice, OrigenPrecio } from '../entities/supply-price.entity';
import { Apu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Project } from '../entities/project.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import {
  CreateSupplyDto,
  UpdateSupplyDto,
  CreatePriceDto,
  ListPricesDto,
} from './supplies.dto';

interface FilaInsumoImportacion {
  fila: number;
  descripcion: string;
  unidad: string;
  grupo: string;
  error: string | null;
  nuevo: boolean;
}

interface JobInsumoImportacion {
  shopId: string;
  filas: FilaInsumoImportacion[];
  nuevos: number;
  actualizados: number;
  conError: number;
  expira: number;
}

const JOB_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class SuppliesService {
  constructor(
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(SupplyPrice) private readonly priceRepo: Repository<SupplyPrice>,
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(ApuComponent) private readonly componentRepo: Repository<ApuComponent>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    private readonly costEngine: CostEngine,
  ) {}

  // ---- Insumos ------------------------------------------------------------

  async listar(shopId: string, opts: { grupo?: string; q?: string; page?: number; per_page?: number }) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(opts.per_page ?? 20)));

    const qb = this.supplyRepo
      .createQueryBuilder('s')
      .where('s.shop_id = :shopId', { shopId })
      .orderBy('s.grupo', 'ASC')
      .addOrderBy('s.descripcion', 'ASC');

    if (opts.grupo) qb.andWhere('s.grupo = :grupo', { grupo: opts.grupo });
    if (opts.q) qb.andWhere('s.descripcion ILIKE :q', { q: `%${opts.q}%` });

    const [rows, total] = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();

    // Precio vigente de cada insumo
    const items = await Promise.all(
      rows.map(async (s) => {
        const precio = await this.costEngine.precioVigente(s.id);
        return {
          ...s,
          precio_vigente: precio.existe ? precio.valor : null,
          usa_precio_historico: precio.historico,
        };
      }),
    );

    return { items, total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) };
  }

  async obtener(shopId: string, id: string) {
    const supply = await this.supplyRepo.findOne({ where: { id, shop_id: shopId } });
    if (!supply) throw new NotFoundException('Insumo no encontrado');
    return supply;
  }

  async crear(shopId: string, dto: CreateSupplyDto) {
    const supply = this.supplyRepo.create({
      shop_id: shopId,
      descripcion: dto.descripcion,
      unidad: dto.unidad,
      grupo: dto.grupo,
    });
    return this.supplyRepo.save(supply);
  }

  async actualizar(shopId: string, id: string, dto: UpdateSupplyDto) {
    const supply = await this.obtener(shopId, id);
    if (dto.descripcion !== undefined) supply.descripcion = dto.descripcion;
    if (dto.unidad !== undefined) supply.unidad = dto.unidad;
    if (dto.grupo !== undefined) supply.grupo = dto.grupo;
    return this.supplyRepo.save(supply);
  }

  async eliminar(shopId: string, id: string) {
    const supply = await this.obtener(shopId, id);
    await this.priceRepo.delete({ supply_id: id });
    await this.supplyRepo.delete({ id, shop_id: shopId });
    return { ok: true };
  }

  // ---- Precios ------------------------------------------------------------

  async listarPrecios(shopId: string, supplyId: string, opts: ListPricesDto) {
    const supply = await this.obtener(shopId, supplyId);
    const prices = await this.priceRepo.find({
      where: { supply_id: supply.id },
      order: { vigente_desde: 'DESC' },
      take: opts.limit ?? 10,
    });
    return prices;
  }

  /**
   * Registra un precio. Si tiene vigente_desde futuro, solo se crea (no cambia
   * el precio actual). Si es la serie vigente, se propaga a los snapshots de
   * presupuestos en BORRADOR y se notifica el impacto.
   */
  async registrarPrecio(shopId: string, supplyId: string, dto: CreatePriceDto, usuario?: string) {
    const supply = await this.obtener(shopId, supplyId);

    const price = this.priceRepo.create({
      supply_id: supply.id,
      valor: String(dto.valor),
      vigente_desde: dto.vigente_desde ? new Date(dto.vigente_desde) : new Date(),
      usuario: dto.usuario ?? usuario ?? null,
      motivo: dto.motivo ?? null,
      origen: dto.origen ?? OrigenPrecio.MANUAL,
    });
    await this.priceRepo.save(price);

    // Si es vigente (no futuro), propagar a snapshots de borrador.
    const futuro = price.vigente_desde.getTime() > Date.now();
    if (!futuro) {
      const items = await this.itemRepo
        .createQueryBuilder('i')
        .where('i.apu_snapshot @> :filtro', {
          filtro: JSON.stringify({ componentes: [{ insumo_id: supplyId }] }),
        })
        .getMany();

      const projectIds = [...new Set(items.map((i) => i.project_id))];
      const proyectos = projectIds.length
        ? await this.projectRepo.find({ where: { id: In(projectIds) } })
        : [];
      const afectados = proyectos.filter((p) => p.estado === 'BORRADOR');

      for (const item of items) {
        const proy = proyectos.find((p) => p.id === item.project_id);
        if (!proy || proy.estado !== 'BORRADOR') continue;

        const snapshot = item.apu_snapshot;
        let cambioCosto = false;
        const nuevos = snapshot.componentes.map((c) => {
          if (c.insumo_id !== supplyId) return c;
          if (c.valor === price.valor) return c;
          cambioCosto = true;
          const nuevoValor = price.valor;
          const subtotal = Math.round(parseFloat(c.rendimiento) * parseFloat(nuevoValor) * 100) / 100;
          return { ...c, valor: nuevoValor, subtotal: String(subtotal) };
        });
        snapshot.componentes = nuevos;
        item.apu_snapshot = snapshot;

        if (cambioCosto) {
          const nuevoCosto = nuevos.reduce((acc, c) => acc + parseFloat(c.subtotal), 0);
          item.valor_unitario = nuevoCosto.toFixed(2);
          await this.itemRepo.save(item);
        }
      }

      void afectados;
    }

    return price;
  }

  async recalcula (shopId: string, opts: { grupo?: string }) {
    const qb = this.supplyRepo.createQueryBuilder('s').where('s.shop_id = :shopId', { shopId });
    if (opts.grupo) qb.andWhere('s.grupo = :grupo', { grupo: opts.grupo });
    const supplies = await qb.getMany();

    let sinPrecio = 0;
    for (const s of supplies) {
      const p = await this.costEngine.precioVigente(s.id);
      if (!p.existe) sinPrecio++;
    }

    return {
      ok: true,
      total_insumos: supplies.length,
      sin_precio: sinPrecio,
      recalculado: true,
    };
  }

  // ---- HU-15: dónde se usa un insumo --------------------------------------

  /**
   * HU-15. Convierte el contador de la interfaz en información navegable:
   * qué APUs del catálogo usan el insumo y (opcionalmente) cómo impacta en un
   * proyecto activo.
   */
  async uso(shopId: string, supplyId: string, projectId?: string) {
    const supply = await this.obtener(shopId, supplyId);

    // APUs activos del catálogo que usan el insumo.
    const componentes = await this.componentRepo
      .createQueryBuilder('c')
      .innerJoin(Apu, 'a', 'a.id = c.apu_id')
      .where('c.insumo_id = :supplyId', { supplyId })
      .andWhere('a.shop_id = :shopId', { shopId })
      .andWhere('a.deleted_at IS NULL')
      .select('c.apu_id', 'apu_id')
      .addSelect('c.rendimiento', 'rendimiento')
      .addSelect('a.codigo', 'codigo')
      .addSelect('a.descripcion', 'descripcion')
      .getRawMany();

    const apus = componentes.map((c) => ({
      id: c.apu_id,
      codigo: c.codigo,
      descripcion: c.descripcion,
      rendimiento: String(c.rendimiento),
    }));

    // Impacto en el proyecto activo indicado (si se pasa).
    let enProyectoActivo = null;
    if (projectId) {
      const project = await this.projectRepo.findOne({
        where: { id: projectId, shop_id: shopId, deleted_at: null },
      });
      if (!project) throw new NotFoundException('Proyecto no encontrado');

      const items = await this.itemRepo
        .createQueryBuilder('i')
        .where('i.project_id = :projectId', { projectId })
        .andWhere('i.deleted_at IS NULL')
        .andWhere('i.apu_snapshot @> :filtro', {
          filtro: JSON.stringify({ componentes: [{ insumo_id: supplyId }] }),
        })
        .getMany();

      const valorAfectado = items.reduce(
        (acc, i) => acc + Math.round(parseFloat(i.cantidad) * parseFloat(i.valor_unitario) * 100),
        0,
      );

      enProyectoActivo = {
        actividades: items.length,
        valor_afectado: (valorAfectado / 100).toFixed(2),
      };
    }

    return {
      insumo_id: supply.id,
      descripcion: supply.descripcion,
      unidad: supply.unidad,
      total_apus: apus.length,
      apus,
      en_proyecto_activo: enProyectoActivo,
    };
  }
}