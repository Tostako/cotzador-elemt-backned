import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import { Supply, GrupoInsumo } from '../entities/supply.entity';
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

  private readonly insumoJobs = new Map<string, JobInsumoImportacion>();

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

  // ---- Importación masiva de insumos (mismo patrón que HU-13) -------------

  /**
   * Formato de hoja "Insumos" (o primera hoja): columnas descripcion, unidad,
   * grupo. Grupo: MATERIAL, MANO_OBRA, EQUIPO o TRANSPORTE. Una fila por
   * insumo; si la descripción ya existe en el shop se marca como actualizado.
   */
  async previsualizarImportacion(shopId: string, buffer: Buffer) {
    let workbook: ExcelJS.Workbook;
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException({
        error: 'ARCHIVO_INVALIDO',
        mensaje: 'El archivo no es un XLSX válido',
      });
    }

    const hoja =
      workbook.worksheets.find((w) => w.name.toLowerCase().replace(/[^a-z]/g, '') === 'insumos') ??
      workbook.worksheets[0];
    if (!hoja) {
      throw new BadRequestException({
        error: 'ARCHIVO_VACIO',
        mensaje: 'El XLSX no contiene hojas',
      });
    }

    const crudas: Array<{ fila: number; celdas: string[] }> = [];
    hoja.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const vals = row.values as Array<unknown>;
      const celdas = (vals ?? []).slice(1).map((v) => (v != null ? String(v).trim() : ''));
      crudas.push({ fila: rowNumber, celdas });
    });

    const filas: FilaInsumoImportacion[] = [];
    const vistos = new Map<string, number>();

    for (const { fila, celdas } of crudas) {
      const [descripcion, unidad, grupo] = celdas;
      if (!descripcion && !unidad && !grupo) continue; // fila vacía

      let error: string | null = null;
      if (!descripcion) error = 'Falta la descripción';
      else if (!unidad) error = 'Falta la unidad';
      else if (!grupo) error = 'Falta el grupo';

      const clave = descripcion.toLowerCase();
      if (!error && vistos.has(clave)) {
        error = `La descripción "${descripcion}" está duplicada en la fila ${vistos.get(clave)}`;
      }
      if (!error) vistos.set(clave, fila);

      if (!error && !Object.values(GrupoInsumo).includes(grupo.toUpperCase() as GrupoInsumo)) {
        error = `Grupo "${grupo}" inválido (use MATERIAL, MANO_OBRA, EQUIPO o TRANSPORTE)`;
      }

      let existe = false;
      if (!error) {
        existe = !!(await this.supplyRepo
          .createQueryBuilder('s')
          .where('s.shop_id = :shopId', { shopId })
          .andWhere('LOWER(s.descripcion) = LOWER(:desc)', { desc: descripcion })
          .getOne());
      }

      filas.push({
        fila,
        descripcion: descripcion || '',
        unidad: unidad || '',
        grupo: grupo ? grupo.toUpperCase() : '',
        error,
        nuevo: !existe,
      });
    }

    const conError = filas.filter((f) => f.error).length;
    const nuevos = filas.filter((f) => !f.error && f.nuevo).length;
    const actualizados = filas.filter((f) => !f.error && !f.nuevo).length;

    const jobId = randomUUID();
    const job: JobInsumoImportacion = {
      shopId,
      filas,
      nuevos,
      actualizados,
      conError,
      expira: Date.now() + JOB_TTL_MS,
    };
    this.insumoJobs.set(jobId, job);

    return {
      job_id: jobId,
      nuevos,
      actualizados,
      con_error: conError,
      expira_en: JOB_TTL_MS,
    };
  }

  /**
   * Aplica el lote previsualizado de insumos. Atómico: todo o nada, con punto
   * de restauración previo y rollback manual en caso de fallo.
   */
  async confirmarImportacion(shopId: string, jobId: string) {
    const job = this.insumoJobs.get(jobId);
    if (!job || job.expira < Date.now()) {
      throw new GoneException({
        error: 'JOB_EXPIRADO',
        mensaje: 'La importación expiró o no existe',
      });
    }
    if (job.shopId !== shopId) throw new NotFoundException('Importación no encontrada');
    this.insumoJobs.delete(jobId);

    const validas = job.filas.filter((f) => !f.error);
    if (job.conError > 0) {
      throw new UnprocessableEntityException({
        error: 'LOTE_CON_ERRORES',
        mensaje: `Hay ${job.conError} fila(s) con error. Corrija el archivo e importe de nuevo.`,
        filas_con_error: job.filas.filter((f) => f.error).map((f) => ({ fila: f.fila, error: f.error })),
      });
    }

    const restorePointId = randomUUID();
    const descripciones = validas.map((f) => f.descripcion);
    const previos = descripciones.length
      ? await this.supplyRepo
          .createQueryBuilder('s')
          .where('s.shop_id = :shopId', { shopId })
          .andWhere('LOWER(s.descripcion) IN (:...desc)', { desc: descripciones.map((d) => d.toLowerCase()) })
          .getMany()
      : [];
    const estadoPrevio = previos.map((s) => ({
      id: s.id,
      descripcion: s.descripcion,
      unidad: s.unidad,
      grupo: s.grupo,
    }));

    let aplicados = 0;
    const creadosIds: string[] = [];
    try {
      for (const f of validas) {
        const existente = await this.supplyRepo
          .createQueryBuilder('s')
          .where('s.shop_id = :shopId', { shopId })
          .andWhere('LOWER(s.descripcion) = LOWER(:desc)', { desc: f.descripcion })
          .getOne();

        if (existente) {
          existente.unidad = f.unidad;
          existente.grupo = f.grupo as GrupoInsumo;
          await this.supplyRepo.save(existente);
        } else {
          const creado = await this.supplyRepo.save(
            this.supplyRepo.create({
              shop_id: shopId,
              descripcion: f.descripcion,
              unidad: f.unidad,
              grupo: f.grupo as GrupoInsumo,
            }),
          );
          creadosIds.push(creado.id);
        }
        aplicados += 1;
      }
    } catch (err) {
      // Rollback manual: restaurar los insumos previos y borrar los creados.
      for (const s of previos) {
        const sup = await this.supplyRepo.findOne({ where: { id: s.id } });
        if (sup) {
          sup.descripcion = s.descripcion;
          sup.unidad = s.unidad;
          sup.grupo = s.grupo;
          await this.supplyRepo.save(sup);
        }
      }
      if (creadosIds.length) {
        await this.priceRepo.delete({ supply_id: In(creadosIds) });
        await this.supplyRepo.delete({ id: In(creadosIds) });
      }
      throw new UnprocessableEntityException({
        error: 'IMPORTACION_FALLIDA',
        mensaje: 'La importación falló y fue revertida por completo',
      });
    }

    return {
      aplicados,
      restore_point_id: restorePointId,
      punto_restauracion: estadoPrevio,
    };
  }
}