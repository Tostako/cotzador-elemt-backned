import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  GoneException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import { Chapter } from '../entities/chapter.entity';
import { Apu, OrigenApu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Project } from '../entities/project.entity';
import { Supply, GrupoInsumo } from '../entities/supply.entity';
import { SupplyPrice, OrigenPrecio } from '../entities/supply-price.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { fromCents, toCents } from '../common/money';
import {
  CreateChapterDto,
  UpdateChapterDto,
  CreateApuDto,
  UpdateApuDto,
  DuplicarApuDto,
} from './catalog.dto';
import {
  firmarConfirmacion,
  confirmacionValidaParaDatos,
} from '../common/confirmation-token';

interface FilaImportacion {
  fila: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  capitulo: string;
  chapter_id: string | null;
  componentes: Array<{ insumo_id: string; rendimiento: string }>;
  error: string | null;
  nuevo: boolean;
}

interface JobImportacion {
  tipo: 'APU';
  shopId: string;
  filas: FilaImportacion[];
  nuevos: number;
  actualizados: number;
  conError: number;
  expira: number;
}

interface FilaInsumoImportacion {
  fila: number;
  descripcion: string;
  unidad: string;
  grupo: string;
  precio: number | null;
  error: string | null;
  nuevo: boolean;
}

interface JobInsumoImportacion {
  tipo: 'INSUMO';
  shopId: string;
  filas: FilaInsumoImportacion[];
  nuevos: number;
  actualizados: number;
  conError: number;
  expira: number;
}

const JOB_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Chapter) private readonly chapterRepo: Repository<Chapter>,
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(ApuComponent) private readonly componentRepo: Repository<ApuComponent>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(SupplyPrice) private readonly priceRepo: Repository<SupplyPrice>,
    private readonly costEngine: CostEngine,
  ) {}

  /** Extrae el detalle de filas con error en forma legible. */
  private detalleErrores(filas: Array<{ fila: number; error: string | null }>): Array<{ fila: number; error: string }> {
    return filas.filter((f) => f.error).map((f) => ({ fila: f.fila, error: f.error! }));
  }

  /** Mensaje de error que incluye las filas y motivos (no solo el conteo). */
  private mensajeErrores(conError: number, detalle: Array<{ fila: number; error: string }>): string {
    const lista = detalle
      .slice(0, 10)
      .map((d) => `fila ${d.fila}: ${d.error}`)
      .join('; ');
    const mas = detalle.length > 10 ? ` y ${detalle.length - 10} más` : '';
    return `Hay ${conError} fila(s) con error (${lista}${mas}). Corrija el archivo e importe de nuevo.`;
  }

  private readonly importJobs = new Map<string, JobImportacion | JobInsumoImportacion>();

  // ---- Capítulos ----------------------------------------------------------

  async listarCapitulos(shopId: string) {
    return this.chapterRepo.find({
      where: { shop_id: shopId },
      order: { orden: 'ASC', nombre: 'ASC' },
    });
  }

  async crearCapitulo(shopId: string, dto: CreateChapterDto) {
    const chapter = this.chapterRepo.create({
      shop_id: shopId,
      nombre: dto.nombre,
      codigo: dto.codigo ?? null,
      orden: dto.orden ?? 0,
    });
    return this.chapterRepo.save(chapter);
  }

  async actualizarCapitulo(shopId: string, id: string, dto: UpdateChapterDto) {
    const chapter = await this.chapterRepo.findOne({ where: { id, shop_id: shopId } });
    if (!chapter) throw new NotFoundException('Capítulo no encontrado');
    if (dto.nombre !== undefined) chapter.nombre = dto.nombre;
    if (dto.codigo !== undefined) chapter.codigo = dto.codigo;
    if (dto.orden !== undefined) chapter.orden = dto.orden;
    return this.chapterRepo.save(chapter);
  }

  async eliminarCapitulo(shopId: string, id: string) {
    const chapter = await this.chapterRepo.findOne({ where: { id, shop_id: shopId } });
    if (!chapter) throw new NotFoundException('Capítulo no encontrado');

    const apusEnCapitulo = await this.apuRepo.count({ where: { chapter_id: id, deleted_at: null } });
    if (apusEnCapitulo > 0) {
      throw new BadRequestException({
        error: 'CAPITULO_EN_USO',
        mensaje: 'El capítulo contiene APUs activos',
      });
    }
    await this.chapterRepo.delete({ id });
    return { ok: true };
  }

  // ---- APUs ---------------------------------------------------------------

  async poblarApus(shopId: string, apus: Apu[]) {
    if (!apus.length) return [];

    const apuIds = apus.map((a) => a.id);

    // 1. Obtener componentes
    const componentes = await this.componentRepo.find({
      where: { apu_id: In(apuIds) },
    });

    // 2. Obtener insumos
    const insumoIds = [...new Set(componentes.map((c) => c.insumo_id))];
    const insumos = insumoIds.length
      ? await this.supplyRepo.find({ where: { id: In(insumoIds), shop_id: shopId } })
      : [];
    const supplyMap = new Map(insumos.map((s) => [s.id, s]));

    // 3. Obtener precios vigentes
    const priceMap = new Map<string, string>();
    for (const id of insumoIds) {
      const p = await this.costEngine.precioVigente(id);
      priceMap.set(id, p.valor);
    }

    // 4. Agrupar componentes por APU
    const compMap = new Map<string, any[]>();
    for (const c of componentes) {
      const insumo = supplyMap.get(c.insumo_id);
      if (!insumo) continue;

      const precio = priceMap.get(c.insumo_id) ?? '0.00';
      const subtotalCents = Math.round(toCents(precio) * parseCantidad(c.rendimiento));
      const subtotal = fromCents(subtotalCents);

      const mappedComp = {
        insumo_id: c.insumo_id,
        insumoId: c.insumo_id,
        descripcion: insumo.descripcion,
        grupo: insumo.grupo,
        unidad: insumo.unidad,
        rendimiento: c.rendimiento,
        valor: precio,
        costo_unitario: precio,
        costoUnitario: precio,
        subtotal: subtotal,
      };

      const list = compMap.get(c.apu_id) ?? [];
      list.push(mappedComp);
      compMap.set(c.apu_id, list);
    }

    // 5. Obtener capítulos
    const chapterIds = apus.map((a) => a.chapter_id).filter((id): id is string => !!id);
    const chapters = chapterIds.length ? await this.chapterRepo.find({ where: { id: In(chapterIds) } }) : [];
    const chapterMap = new Map(chapters.map((c) => [c.id, c]));

    return apus.map((a) => {
      const comps = compMap.get(a.id) ?? [];
      const totalCents = comps.reduce((s, c) => s + toCents(c.subtotal), 0);
      const ch = a.chapter_id ? chapterMap.get(a.chapter_id) : null;

      const desglose = {
        materiales: fromCents(comps.filter((c) => c.grupo === 'MATERIAL').reduce((s, c) => s + toCents(c.subtotal), 0)),
        manoObra: fromCents(comps.filter((c) => c.grupo === 'MANO_OBRA').reduce((s, c) => s + toCents(c.subtotal), 0)),
        equipo: fromCents(comps.filter((c) => c.grupo === 'EQUIPO').reduce((s, c) => s + toCents(c.subtotal), 0)),
        transporte: fromCents(comps.filter((c) => c.grupo === 'TRANSPORTE').reduce((s, c) => s + toCents(c.subtotal), 0)),
      };

      return {
        ...a,
        capitulo: ch ? { id: ch.id, nombre: ch.nombre } : null,
        componentes: comps,
        costo_unitario: fromCents(totalCents),
        costoUnitario: fromCents(totalCents),
        desglose,
      };
    });
  }

  async listarApus(shopId: string, opts: { chapter_id?: string; q?: string; page?: number; per_page?: number }) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(opts.per_page ?? 20)));

    const qb = this.apuRepo
      .createQueryBuilder('a')
      .where('a.shop_id = :shopId', { shopId })
      .andWhere('a.deleted_at IS NULL')
      .orderBy('a.codigo', 'ASC');

    if (opts.chapter_id) {
      qb.andWhere('a.chapter_id = :chapterId', { chapterId: opts.chapter_id });
    }
    if (opts.q) {
      qb.andWhere('(a.codigo ILIKE :q OR a.descripcion ILIKE :q)', { q: `%${opts.q}%` });
    }

    const [rows, total] = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();

    const itemsPoblados = await this.poblarApus(shopId, rows);
    return { items: itemsPoblados, total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) };
  }

  /**
   * Exporta el catálogo de APUs (filtrado por chapter_id/q) a XLSX, en el mismo
   * formato que acepta la importación (round-trip). Genera el archivo en el
   * servidor y lo devuelve como buffer para streaming; no pagina.
   */
  async exportarApus(shopId: string, opts: { chapter_id?: string; q?: string }): Promise<Buffer> {
    const qb = this.apuRepo
      .createQueryBuilder('a')
      .where('a.shop_id = :shopId', { shopId })
      .andWhere('a.deleted_at IS NULL')
      .orderBy('a.codigo', 'ASC');
    if (opts.chapter_id) qb.andWhere('a.chapter_id = :chapterId', { chapterId: opts.chapter_id });
    if (opts.q) qb.andWhere('(a.codigo ILIKE :q OR a.descripcion ILIKE :q)', { q: `%${opts.q}%` });
    const apus = await qb.getMany();

    const chapterIds = apus.map((a) => a.chapter_id).filter((id): id is string => !!id);
    const chapters = chapterIds.length ? await this.chapterRepo.find({ where: { id: In(chapterIds) } }) : [];
    const mapCap = new Map(chapters.map((c) => [c.id, c.nombre]));

    const apuIds = apus.map((a) => a.id);
    const componentes = apuIds.length ? await this.componentRepo.find({ where: { apu_id: In(apuIds) } }) : [];
    const insumoIds = [...new Set(componentes.map((c) => c.insumo_id))];
    const insumos = insumoIds.length ? await this.supplyRepo.find({ where: { id: In(insumoIds) } }) : [];
    const mapIns = new Map(insumos.map((s) => [s.id, s.descripcion]));

    const compPorApu = new Map<string, string[]>();
    for (const c of componentes) {
      const desc = mapIns.get(c.insumo_id) ?? '?';
      const lista = compPorApu.get(c.apu_id) ?? [];
      lista.push(`${desc}:${c.rendimiento}`);
      compPorApu.set(c.apu_id, lista);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('APUs');
    ws.addRow(['codigo', 'descripcion', 'unidad', 'capitulo', 'componentes']);
    for (const a of apus) {
      ws.addRow([
        a.codigo,
        a.descripcion,
        a.unidad,
        a.chapter_id ? (mapCap.get(a.chapter_id) ?? '') : '',
        (compPorApu.get(a.id) ?? []).join('; '),
      ]);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async obtenerApu(shopId: string, id: string) {
    const apu = await this.apuRepo.findOne({ where: { id, shop_id: shopId, deleted_at: null } });
    if (!apu) throw new NotFoundException('APU no encontrado');

    const [poblado] = await this.poblarApus(shopId, [apu]);
    const calculo = await this.costEngine.costoApu(id);

    return { ...poblado, avisos: calculo.avisos };
  }

  async crearApu(shopId: string, dto: CreateApuDto) {
    const existe = await this.apuRepo.findOne({
      where: { shop_id: shopId, codigo: dto.codigo, deleted_at: null },
    });
    if (existe) {
      throw new BadRequestException({
        error: 'APU_CODIGO_EXISTENTE',
        mensaje: `Ya existe un APU con código ${dto.codigo}`,
      });
    }

    if (dto.chapter_id) {
      const chapter = await this.chapterRepo.findOne({ where: { id: dto.chapter_id, shop_id: shopId } });
      if (!chapter) throw new NotFoundException('Capítulo no encontrado');
    }

    const apu = this.apuRepo.create({
      shop_id: shopId,
      chapter_id: dto.chapter_id ?? null,
      codigo: dto.codigo,
      descripcion: dto.descripcion,
      unidad: dto.unidad,
      origen: dto.origen ?? OrigenApu.PERSONALIZADO,
    });
    const saved = await this.apuRepo.save(apu);

    if (dto.componentes?.length) {
      const comps = dto.componentes.map((c) =>
        this.componentRepo.create({
          apu_id: saved.id,
          insumo_id: c.insumo_id,
          rendimiento: String(c.rendimiento),
        }),
      );
      await this.componentRepo.save(comps);
    }

    return this.obtenerApu(shopId, saved.id);
  }

  async actualizarApu(shopId: string, id: string, dto: UpdateApuDto) {
    const apu = await this.apuRepo.findOne({ where: { id, shop_id: shopId, deleted_at: null } });
    if (!apu) throw new NotFoundException('APU no encontrado');

    if (dto.codigo !== undefined && dto.codigo !== apu.codigo) {
      const existe = await this.apuRepo.findOne({
        where: { shop_id: shopId, codigo: dto.codigo, deleted_at: null },
      });
      if (existe) {
        throw new BadRequestException({
          error: 'APU_CODIGO_EXISTENTE',
          mensaje: `Ya existe un APU con código ${dto.codigo}`,
        });
      }
      apu.codigo = dto.codigo;
    }
    if (dto.descripcion !== undefined) apu.descripcion = dto.descripcion;
    if (dto.unidad !== undefined) apu.unidad = dto.unidad;
    if (dto.chapter_id !== undefined) apu.chapter_id = dto.chapter_id;
    apu.version = apu.version + 1;
    await this.apuRepo.save(apu);

    if (dto.componentes !== undefined) {
      await this.componentRepo.delete({ apu_id: id });
      if (dto.componentes.length) {
        const comps = dto.componentes.map((c) =>
          this.componentRepo.create({
            apu_id: id,
            insumo_id: c.insumo_id,
            rendimiento: String(c.rendimiento),
          }),
        );
        await this.componentRepo.save(comps);
      }
    }

    return this.obtenerApu(shopId, id);
  }

  async eliminarApu(shopId: string, id: string) {
    const apu = await this.apuRepo.findOne({ where: { id, shop_id: shopId, deleted_at: null } });
    if (!apu) throw new NotFoundException('APU no encontrado');
    apu.deleted_at = new Date();
    await this.apuRepo.save(apu);
    return { ok: true };
  }

  /** Fuente única de contadores del catálogo (decisión H-13, HU-09). */
  async counters(shopId: string, projectId?: string) {
    const apusCatalogo = await this.apuRepo.count({
      where: { shop_id: shopId, deleted_at: null },
    });
    const apusPersonalizados = await this.apuRepo.count({
      where: { shop_id: shopId, origen: OrigenApu.PERSONALIZADO, deleted_at: null },
    });
    const insumosCatalogo = await this.supplyRepo.count({ where: { shop_id: shopId } });

    let apusEnProyecto = 0;
    if (projectId) {
      apusEnProyecto = await this.itemRepo.count({
        where: { project_id: projectId, deleted_at: null },
      });
    }

    return {
      apus_catalogo: apusCatalogo,
      apus_en_proyecto: apusEnProyecto,
      apus_personalizados: apusPersonalizados,
      insumos_catalogo: insumosCatalogo,
      computed_at: new Date().toISOString(),
    };
  }

  // ---- Fase 2: duplicar APU (HU-12) ---------------------------------------

  async duplicarApu(shopId: string, id: string, dto: DuplicarApuDto) {
    const origen = await this.apuRepo.findOne({ where: { id, shop_id: shopId, deleted_at: null } });
    if (!origen) throw new NotFoundException('APU no encontrado');
    if (origen.descripcion === dto.descripcion) {
      throw new BadRequestException({
        error: 'APU_DESCRIPCION_IGUAL',
        mensaje: 'La descripción de la copia debe diferir del original',
      });
    }

    // Código: derivado del original con sufijo, probando colisiones.
    const base = origen.codigo.slice(0, 26);
    let codigo = `${base}-2`;
    let sufijo = 2;
    for (;;) {
      const existe = await this.apuRepo.findOne({
        where: { shop_id: shopId, codigo, deleted_at: null },
      });
      if (!existe) break;
      sufijo += 1;
      codigo = `${base}-${sufijo}`;
    }

    const apu = this.apuRepo.create({
      shop_id: shopId,
      chapter_id: origen.chapter_id,
      codigo,
      descripcion: dto.descripcion,
      unidad: origen.unidad,
      origen: OrigenApu.PERSONALIZADO,
      version: 1,
    });
    const saved = await this.apuRepo.save(apu);

    const componentes = await this.componentRepo.find({ where: { apu_id: origen.id } });
    if (componentes.length) {
      const copias = componentes.map((c) =>
        this.componentRepo.create({
          apu_id: saved.id,
          insumo_id: c.insumo_id,
          rendimiento: c.rendimiento,
        }),
      );
      await this.componentRepo.save(copias);
    }

    return this.obtenerApu(shopId, saved.id);
  }

  // ---- Fase 2: impacto de edición de APU (HU-11) -----------------------

  /** Conteo de proyectos/presupuestos que usan el APU. */
  private async usoProyectos(apuId: string): Promise<{
    proyectosActivos: number;
    borrador: number;
    aprobado: number;
  }> {
    const items = await this.itemRepo.find({ where: { apu_id: apuId } });
    if (!items.length) return { proyectosActivos: 0, borrador: 0, aprobado: 0 };

    const ids = [...new Set(items.map((i) => i.project_id))];
    const proyectos = ids.length
      ? await this.projectRepo.find({ where: { id: In(ids), deleted_at: null } })
      : [];
    const activos = proyectos.filter((p) => p.estado !== 'ARCHIVADO');
    return {
      proyectosActivos: activos.length,
      borrador: proyectos.filter((p) => p.estado === 'BORRADOR').length,
      aprobado: proyectos.filter((p) => p.estado === 'APROBADO').length,
    };
  }

  /** Impacto de una edición propuesta (o simple consulta). Devuelve token si hay cambios. */
  async impactoApu(shopId: string, id: string, dto?: UpdateApuDto) {
    const apu = await this.apuRepo.findOne({ where: { id, shop_id: shopId, deleted_at: null } });
    if (!apu) throw new NotFoundException('APU no encontrado');

    const uso = await this.usoProyectos(id);
    const actual = await this.costEngine.costoApu(id);

    let variacionUnitaria = '0.00';
    let confirmationToken: string | null = null;

    if (dto && dto.componentes !== undefined) {
      const propuesta = await this.costEngine.costoDeComponentes(dto.componentes);
      const diff = Math.round(toCents(propuesta.costo_unitario) - toCents(actual.costo_unitario));
      variacionUnitaria = fromCents(diff);
      if (diff !== 0) {
        confirmationToken = firmarConfirmacion('APU_EDIT', shopId, id, dto);
      }
    }

    return {
      proyectos_activos: uso.proyectosActivos,
      presupuestos_borrador: uso.borrador,
      presupuestos_aprobados: uso.aprobado,
      variacion_unitaria: variacionUnitaria,
      confirmation_token: confirmationToken,
    };
  }

  /**
   * Aplica una edición de APU con confirmación de impacto. Si dryRun=true
   * devuelve sólo el análisis con token; si viene X-Confirmation-Token válido
   * para los mismos datos, aplica.
   */
  async editarApuConImpacto(
    shopId: string,
    id: string,
    dto: UpdateApuDto,
    dryRun?: boolean,
    confirmationToken?: string,
  ) {
    const apu = await this.apuRepo.findOne({ where: { id, shop_id: shopId, deleted_at: null } });
    if (!apu) throw new NotFoundException('APU no encontrado');

    const impacto = await this.impactoApu(shopId, id, dto);

    // Sin diferencia de costo → se aplica directo.
    if (impacto.confirmation_token === null) {
      return this.actualizarApu(shopId, id, dto);
    }

    if (dryRun) {
      return { dry_run: true, ...impacto, confirmado: false };
    }

    if (!confirmacionValidaParaDatos(confirmationToken, 'APU_EDIT', shopId, id, dto)) {
      throw new UnprocessableEntityException({
        error: 'CONFIRMACION_REQUERIDA',
        mensaje:
          'Esta edición cambia el costo del APU. Llame primero con dryRun=true y envíe el X-Confirmation-Token devuelto.',
        impacto: {
          proyectos_activos: impacto.proyectos_activos,
          variacion_unitaria: impacto.variacion_unitaria,
        },
      });
    }

    return this.actualizarApu(shopId, id, dto);
  }

  // ---- HU-13: importación masiva de APUs (XLSX) ---------------------------

  /**
   * HU-13. Previsualiza una importación de APUs desde un XLSX. No aplica nada:
   * devuelve un jobId que se confirma aparte.
   *
   * Formato de hoja "APUs": columnas codigo, descripcion, unidad, capitulo
   * (nombre, opcional) y componentes como "insumo:rendimiento;insumo:rendimiento"
   * donde insumo es la descripción exacta del maestro de insumos.
   */
  async previsualizarImportacion(shopId: string, buffer: Buffer) {
    let workbook: ExcelJS.Workbook;
    let hoja: ExcelJS.Worksheet | undefined;
    const crudas: Array<{ fila: number; celdas: string[] }> = [];
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      hoja = workbook.worksheets[0];
      if (!hoja) {
        throw new BadRequestException({
          error: 'ARCHIVO_VACIO',
          mensaje: 'El XLSX no contiene hojas',
        });
      }
      hoja.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as Array<unknown>;
        const celdas = (vals ?? []).slice(1).map((v) => (v != null ? String(v).trim() : ''));
        crudas.push({ fila: rowNumber, celdas });
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException({
        error: 'ARCHIVO_NO_COMPATIBLE',
        mensaje:
          'El archivo no es compatible. Sube un XLSX (.xlsx) con la hoja de APUs y las columnas codigo, descripcion, unidad, capitulo, componentes.',
      });
    }

    // Cargas masivas (3 queries) para resolver capítulos, insumos y APUs
    // existentes sin hacer N consultas por fila.
    const chapters = await this.chapterRepo.find({ where: { shop_id: shopId } });
    const mapCapitulos = new Map<string, string>();
    for (const c of chapters) mapCapitulos.set(c.nombre.toLowerCase(), c.id);

    const insumos = await this.supplyRepo.find({ where: { shop_id: shopId } });
    const mapInsumos = new Map<string, string>();
    for (const s of insumos) mapInsumos.set(s.descripcion.toLowerCase(), s.id);

    const apus = await this.apuRepo.find({ where: { shop_id: shopId, deleted_at: null } });
    const mapApus = new Map<string, boolean>();
    for (const a of apus) mapApus.set(a.codigo, true);

    const filas: FilaImportacion[] = [];
    const codigosVistos = new Map<string, number>();

    for (const { fila, celdas } of crudas) {
      const [codigo, descripcion, unidad, capitulo, componentesRaw] = celdas;
      if (!codigo && !descripcion) continue; // fila vacía

      let error: string | null = null;
      if (!codigo) error = 'Falta el código';
      else if (!descripcion) error = 'Falta la descripción';
      else if (!unidad) error = 'Falta la unidad';

      if (!error && codigosVistos.has(codigo)) {
        error = `El código ${codigo} está duplicado en la fila ${codigosVistos.get(codigo)}`;
      }
      if (!error) codigosVistos.set(codigo, fila);

      let componentes: Array<{ insumo_id: string; rendimiento: string }> = [];
      if (!error && componentesRaw) {
        const partes = componentesRaw.split(';').filter((p) => p.trim());
        for (const parte of partes) {
          const idx = parte.lastIndexOf(':');
          if (idx <= 0) {
            error = `Componente "${parte}" sin formato (insumo:rendimiento)`;
            break;
          }
          const descInsumo = parte.slice(0, idx).trim();
          const rendimiento = parte.slice(idx + 1).trim();
          const rend = parseFloat(rendimiento.replace(',', '.'));
          if (!descInsumo || Number.isNaN(rend) || rend <= 0) {
            error = `Componente "${parte}" inválido`;
            break;
          }
          const insumoId = mapInsumos.get(descInsumo.toLowerCase());
          if (!insumoId) {
            error = `Insumo "${descInsumo}" no existe en el maestro`;
            break;
          }
          componentes.push({ insumo_id: insumoId, rendimiento: String(rend) });
        }
      }

      const chapterId =
        !error && capitulo ? mapCapitulos.get(capitulo.trim().toLowerCase()) ?? null : null;
      const existe = !error && codigo ? mapApus.has(codigo) : false;

      filas.push({
        fila,
        codigo: codigo || '',
        descripcion: descripcion || '',
        unidad: unidad || '',
        capitulo: capitulo || '',
        chapter_id: error ? null : chapterId,
        componentes,
        error,
        nuevo: !existe,
      });
    }

    const conError = filas.filter((f) => f.error).length;
    const nuevos = filas.filter((f) => !f.error && f.nuevo).length;
    const actualizados = filas.filter((f) => !f.error && !f.nuevo).length;

    const jobId = randomUUID();
    const job: JobImportacion = {
      tipo: 'APU',
      shopId,
      filas,
      nuevos,
      actualizados,
      conError,
      expira: Date.now() + JOB_TTL_MS,
    };
    this.importJobs.set(jobId, job);

    return {
      job_id: jobId,
      nuevos,
      actualizados,
      con_error: conError,
      filas_con_error: this.detalleErrores(filas),
      expira_en: JOB_TTL_MS,
    };
  }

  /**
   * HU-13. Aplica el lote previsualizado. Atómico: se aplica todo el lote
   * válido o no se aplica nada. Genera un punto de restauración previo.
   */
  async confirmarImportacion(shopId: string, jobId: string) {
    const job = this.importJobs.get(jobId) as JobImportacion | undefined;
    if (!job || job.expira < Date.now()) {
      throw new GoneException({
        error: 'JOB_EXPIRADO',
        mensaje: 'La importación expiró o no existe',
      });
    }
    if (job.shopId !== shopId) throw new NotFoundException('Importación no encontrada');

    const validas = job.filas.filter((f) => !f.error);
    if (job.conError > 0) {
      const detalle = this.detalleErrores(job.filas);
      throw new UnprocessableEntityException({
        error: 'LOTE_CON_ERRORES',
        mensaje: this.mensajeErrores(job.conError, detalle),
        filas_con_error: detalle,
      });
    }
    this.importJobs.delete(jobId);

    // Punto de restauración previo: captura del estado actual de los APUs afectados.
    const restorePointId = randomUUID();
    const codigos = validas.map((f) => f.codigo);
    const previos = codigos.length
      ? await this.apuRepo.find({ where: { shop_id: shopId, codigo: In(codigos) } })
      : [];
    const estadoPrevio = previos.map((a) => ({
      id: a.id,
      codigo: a.codigo,
      descripcion: a.descripcion,
      unidad: a.unidad,
      chapter_id: a.chapter_id,
      version: a.version,
    }));

    // Mapa de APUs existentes (vienen en `previos`) para no consultar por fila.
    const mapExistente = new Map<string, Apu>();
    for (const a of previos) mapExistente.set(a.codigo, a);

    // Separar creaciones de actualizaciones.
    const aCrear: Apu[] = [];
    const aActualizar: Apu[] = [];
    for (const f of validas) {
      const existente = mapExistente.get(f.codigo);
      if (existente) {
        existente.descripcion = f.descripcion;
        existente.unidad = f.unidad;
        existente.chapter_id = f.chapter_id;
        existente.version = existente.version + 1;
        aActualizar.push(existente);
      } else {
        aCrear.push(
          this.apuRepo.create({
            shop_id: shopId,
            chapter_id: f.chapter_id,
            codigo: f.codigo,
            descripcion: f.descripcion,
            unidad: f.unidad,
            origen: OrigenApu.IMPORTADO,
            version: 1,
          }),
        );
      }
    }

    let creadosIds: string[] = [];
    try {
      // Inserción masiva de nuevos APUs (1 statement).
      if (aCrear.length) {
        const raw = await this.apuRepo
          .createQueryBuilder()
          .insert()
          .values(aCrear)
          .returning('*')
          .execute();
        const creados = (raw.raw ?? []) as Apu[];
        creadosIds = creados.map((c) => c.id);
        for (const c of creados) mapExistente.set(c.codigo, c);
      }
      // Actualizar existentes (1 llamada).
      if (aActualizar.length) {
        await this.apuRepo.save(aActualizar);
      }

      // Construir todos los componentes y resolver apu_id por código.
      const todosApusIds: string[] = [];
      const componentes: ApuComponent[] = [];
      for (const f of validas) {
        const apu = mapExistente.get(f.codigo)!;
        todosApusIds.push(apu.id);
        for (const c of f.componentes) {
          componentes.push(
            this.componentRepo.create({
              apu_id: apu.id,
              insumo_id: c.insumo_id,
              rendimiento: c.rendimiento,
            }),
          );
        }
      }

      // Reemplazo masivo de componentes: borra los previos y reinserta (2 statements).
      if (todosApusIds.length) {
        await this.componentRepo.delete({ apu_id: In(todosApusIds) });
        if (componentes.length) {
          await this.componentRepo.insert(componentes);
        }
      }

      return {
        aplicados: validas.length,
        restore_point_id: restorePointId,
        punto_restauracion: estadoPrevio,
      };
    } catch (err) {
      // Rollback manual: restaurar los APUs previos y borrar los creados.
      for (const a of previos) {
        const apu = await this.apuRepo.findOne({ where: { id: a.id } });
        if (apu) {
          apu.descripcion = a.descripcion;
          apu.unidad = a.unidad;
          apu.chapter_id = a.chapter_id;
          apu.version = a.version;
          await this.apuRepo.save(apu);
        }
      }
      if (creadosIds.length) {
        await this.componentRepo.delete({ apu_id: In(creadosIds) });
        await this.apuRepo.delete({ id: In(creadosIds) });
      }
      throw new UnprocessableEntityException({
        error: 'IMPORTACION_FALLIDA',
        mensaje: 'La importación falló y fue revertida por completo',
      });
    }
  }

  // ---- Importación masiva de insumos (mismo registro de jobs que APUs) ----

  /** Indica el tipo de job (APU | INSUMO) o lanza 410/404 si no existe. */
  tipoDeImportacion(shopId: string, jobId: string): 'APU' | 'INSUMO' {
    const job = this.importJobs.get(jobId);
    if (!job || job.expira < Date.now()) {
      throw new GoneException({
        error: 'JOB_EXPIRADO',
        mensaje: 'La importación expiró o no existe',
      });
    }
    if (job.shopId !== shopId) throw new NotFoundException('Importación no encontrada');
    return job.tipo;
  }

  /** Errores por fila de un job previsualizado, sea de APUs o insumos. */
  erroresDeImportacion(shopId: string, jobId: string) {
    const job = this.importJobs.get(jobId);
    if (!job || job.expira < Date.now()) {
      throw new GoneException({
        error: 'JOB_EXPIRADO',
        mensaje: 'La importación expiró o no existe',
      });
    }
    if (job.shopId !== shopId) throw new NotFoundException('Importación no encontrada');
    const filasConError = job.filas.filter((f) => f.error).map((f) => ({ fila: f.fila, error: f.error }));
    return { con_error: filasConError.length, filas_con_error: filasConError };
  }

  /**
   * Formato de hoja "Insumos" (o primera hoja): columnas descripcion, unidad,
   * grupo (MATERIAL, MANO_OBRA, EQUIPO o TRANSPORTE) y precio (opcional, número
   * >= 0). Una fila por insumo; si la descripción ya existe en el shop se marca
   * como actualizado. El precio alimenta el precio vigente (no duplica si ya
   * rige el mismo valor).
   */
  async previsualizarImportacionInsumos(shopId: string, buffer: Buffer) {
    let workbook: ExcelJS.Workbook;
    let hoja: ExcelJS.Worksheet | undefined;
    const crudas: Array<{ fila: number; celdas: string[] }> = [];
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      hoja =
        workbook.worksheets.find((w) => w.name.toLowerCase().replace(/[^a-z]/g, '') === 'insumos') ??
        workbook.worksheets[0];
      if (!hoja) {
        throw new BadRequestException({
          error: 'ARCHIVO_VACIO',
          mensaje: 'El XLSX no contiene hojas',
        });
      }
      hoja.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as Array<unknown>;
        const celdas = (vals ?? []).slice(1).map((v) => (v != null ? String(v).trim() : ''));
        crudas.push({ fila: rowNumber, celdas });
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException({
        error: 'ARCHIVO_NO_COMPATIBLE',
        mensaje:
          'El archivo no es compatible. Sube un XLSX (.xlsx) con la hoja "Insumos" y las columnas descripcion, unidad, grupo, precio.',
      });
    }

    // Carga masiva de insumos existentes (1 query) para resolver "nuevo" sin
    // hacer N consultas por fila.
    const existentes = await this.supplyRepo.find({ where: { shop_id: shopId } });
    const descExistentes = new Set(existentes.map((s) => s.descripcion.toLowerCase()));

    const filas: FilaInsumoImportacion[] = [];
    const vistos = new Map<string, number>();

    for (const { fila, celdas } of crudas) {
      const [descripcion, unidad, grupo, precioRaw] = celdas;
      if (!descripcion && !unidad && !grupo && !precioRaw) continue;

      let error: string | null = null;
      let precio: number | null = null;
      if (precioRaw && precioRaw !== '') {
        const n = Number(String(precioRaw).replace(',', '.'));
        if (Number.isNaN(n) || n < 0) {
          error = `Precio "${precioRaw}" inválido (debe ser un número mayor o igual a 0)`;
        } else {
          precio = n;
        }
      }

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

      const existe = !error && descExistentes.has(clave);

      filas.push({
        fila,
        descripcion: descripcion || '',
        unidad: unidad || '',
        grupo: grupo ? grupo.toUpperCase() : '',
        precio,
        error,
        nuevo: !existe,
      });
    }

    const conError = filas.filter((f) => f.error).length;
    const nuevos = filas.filter((f) => !f.error && f.nuevo).length;
    const actualizados = filas.filter((f) => !f.error && !f.nuevo).length;
    const conPrecio = filas.filter((f) => !f.error && f.precio != null).length;

    const jobId = randomUUID();
    const job: JobInsumoImportacion = {
      tipo: 'INSUMO',
      shopId,
      filas,
      nuevos,
      actualizados,
      conError,
      expira: Date.now() + JOB_TTL_MS,
    };
    this.importJobs.set(jobId, job);

    return {
      job_id: jobId,
      nuevos,
      actualizados,
      con_error: conError,
      con_precio: conPrecio,
      filas_con_error: this.detalleErrores(filas),
      expira_en: JOB_TTL_MS,
    };
  }

  /** Aplica el lote de insumos. Atómico, con punto de restauración y rollback. */
  async confirmarImportacionInsumos(shopId: string, jobId: string) {
    const job = this.importJobs.get(jobId) as JobInsumoImportacion | undefined;
    if (!job || job.expira < Date.now()) {
      throw new GoneException({
        error: 'JOB_EXPIRADO',
        mensaje: 'La importación expiró o no existe',
      });
    }
    if (job.shopId !== shopId) throw new NotFoundException('Importación no encontrada');

    const validas = job.filas.filter((f) => !f.error);
    if (job.conError > 0) {
      const detalle = this.detalleErrores(job.filas);
      throw new UnprocessableEntityException({
        error: 'LOTE_CON_ERRORES',
        mensaje: this.mensajeErrores(job.conError, detalle),
        filas_con_error: detalle,
      });
    }
    this.importJobs.delete(jobId);

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

    // Carga masiva de existentes (1 query) para no consultar por fila.
    const existentes = await this.supplyRepo.find({ where: { shop_id: shopId } });
    const mapExistente = new Map<string, Supply>();
    for (const s of existentes) mapExistente.set(s.descripcion.toLowerCase(), s);

    // Separar creaciones de actualizaciones en memoria.
    const aCrear: Supply[] = [];
    const aActualizar: Supply[] = [];
    for (const f of validas) {
      const clave = f.descripcion.toLowerCase();
      const existente = mapExistente.get(clave);
      if (existente) {
        existente.unidad = f.unidad;
        existente.grupo = f.grupo as GrupoInsumo;
        aActualizar.push(existente);
      } else {
        aCrear.push(
          this.supplyRepo.create({
            shop_id: shopId,
            descripcion: f.descripcion,
            unidad: f.unidad,
            grupo: f.grupo as GrupoInsumo,
          }),
        );
      }
    }

    let creadosIds: string[] = [];
    let creadosPrecioIds: string[] = [];
    try {
      // Inserción masiva de nuevos insumos (1 statement).
      if (aCrear.length) {
        const raw = await this.supplyRepo
          .createQueryBuilder()
          .insert()
          .values(aCrear)
          .returning('*')
          .execute();
        const creados = (raw.raw ?? []) as Supply[];
        creadosIds = creados.map((c) => c.id);
        for (const c of creados) mapExistente.set(c.descripcion.toLowerCase(), c);
      }
      // Actualización masiva de existentes (1 llamada).
      if (aActualizar.length) {
        await this.supplyRepo.save(aActualizar);
      }

      // Resolución de supply_id por descripción (el mapa ya incluye creados).
      const conPrecio = validas.filter((f) => f.precio != null);
      const idsConPrecio = conPrecio.map(
        (f) => mapExistente.get(f.descripcion.toLowerCase())!.id,
      );

      // Precios vigentes actuales (1 query para todos los que traen precio).
      const preciosRows = idsConPrecio.length
        ? await this.priceRepo
            .createQueryBuilder('p')
            .select(['p.supply_id', 'p.valor', 'p.vigente_desde'])
            .where('p.supply_id IN (:...ids)', { ids: idsConPrecio })
            .getRawMany()
        : [];
      // Elige el vigente más reciente; si no hay vigente, el más reciente (histórico).
      const mejor = new Map<string, { valor: string; vigente: boolean; ts: number }>();
      const ahora = Date.now();
      for (const r of preciosRows) {
        const id = r.supply_id as string;
        const ts = new Date(r.vigente_desde as string).getTime();
        const esVig = ts <= ahora;
        const cur = mejor.get(id);
        if (!cur) mejor.set(id, { valor: r.valor as string, vigente: esVig, ts });
        else if (esVig && (!cur.vigente || ts > cur.ts))
          mejor.set(id, { valor: r.valor as string, vigente: true, ts });
        else if (!cur.vigente && ts > cur.ts)
          mejor.set(id, { valor: r.valor as string, vigente: false, ts });
      }

      // Inserción masiva de precios que cambian (1 statement).
      const nuevosPrecios: SupplyPrice[] = [];
      for (const f of conPrecio) {
        const supplyId = mapExistente.get(f.descripcion.toLowerCase())!.id;
        const m = mejor.get(supplyId);
        const existe = !!m;
        const valorVig = m?.valor;
        if (!existe || toCents(valorVig!) !== toCents(f.precio!)) {
          nuevosPrecios.push(
            this.priceRepo.create({
              supply_id: supplyId,
              valor: fromCents(toCents(f.precio!)),
              vigente_desde: new Date(),
              usuario: null,
              motivo: 'Importación masiva',
              origen: OrigenPrecio.IMPORTACION,
            }),
          );
        }
      }
      let preciosRegistrados = 0;
      if (nuevosPrecios.length) {
        const rawP = await this.priceRepo
          .createQueryBuilder()
          .insert()
          .values(nuevosPrecios)
          .returning('*')
          .execute();
        creadosPrecioIds = (rawP.raw ?? []).map((p) => (p as { id: string }).id);
        preciosRegistrados = creadosPrecioIds.length;
      }

      return {
        aplicados: validas.length,
        precios: preciosRegistrados,
        restore_point_id: restorePointId,
        punto_restauracion: estadoPrevio,
      };
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
      if (creadosPrecioIds.length) {
        await this.priceRepo.delete({ id: In(creadosPrecioIds) });
      }
      if (creadosIds.length) {
        await this.supplyRepo.delete({ id: In(creadosIds) });
      }
      throw new UnprocessableEntityException({
        error: 'IMPORTACION_FALLIDA',
        mensaje: 'La importación falló y fue revertida por completo',
      });
    }
  }
}