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
import { Supply } from '../entities/supply.entity';
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
  shopId: string;
  filas: FilaImportacion[];
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
    private readonly costEngine: CostEngine,
  ) {}

  private readonly importJobs = new Map<string, JobImportacion>();

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

    return { items: rows, total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) };
  }

  async obtenerApu(shopId: string, id: string) {
    const apu = await this.apuRepo.findOne({ where: { id, shop_id: shopId, deleted_at: null } });
    if (!apu) throw new NotFoundException('APU no encontrado');

    const componentes = await this.componentRepo.find({ where: { apu_id: id } });
    const calculo = await this.costEngine.costoApu(id);

    return { ...apu, componentes, costo_unitario: calculo.costo_unitario, avisos: calculo.avisos };
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

  /** Resuelve el capítulo por nombre exacto (case-insensitive) dentro del shop. */
  private async resolverCapitulo(shopId: string, nombre?: string): Promise<string | null> {
    if (!nombre || !nombre.trim()) return null;
    const chapter = await this.chapterRepo
      .createQueryBuilder('c')
      .where('c.shop_id = :shopId', { shopId })
      .andWhere('LOWER(c.nombre) = LOWER(:nombre)', { nombre: nombre.trim() })
      .getOne();
    return chapter?.id ?? null;
  }

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
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException({
        error: 'ARCHIVO_INVALIDO',
        mensaje: 'El archivo no es un XLSX válido',
      });
    }

    const hoja = workbook.worksheets[0];
    if (!hoja) {
      throw new BadRequestException({
        error: 'ARCHIVO_VACIO',
        mensaje: 'El XLSX no contiene hojas',
      });
    }

    // 1. Lectura síncrona: extrae filas crudas (encabezado en fila 1).
    const crudas: Array<{ fila: number; celdas: string[] }> = [];
    hoja.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const vals = row.values as Array<unknown>;
      const celdas = (vals ?? []).slice(1).map((v) => (v != null ? String(v).trim() : ''));
      crudas.push({ fila: rowNumber, celdas });
    });

    // 2. Procesado asíncrono: validar y resolver capítulos/insumos.
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
          const insumo = await this.supplyRepo
            .createQueryBuilder('s')
            .where('s.shop_id = :shopId', { shopId })
            .andWhere('LOWER(s.descripcion) = LOWER(:desc)', { desc: descInsumo })
            .getOne();
          if (!insumo) {
            error = `Insumo "${descInsumo}" no existe en el maestro`;
            break;
          }
          componentes.push({ insumo_id: insumo.id, rendimiento: String(rend) });
        }
      }

      const chapterId = await this.resolverCapitulo(shopId, capitulo);
      const existe = codigo
        ? await this.apuRepo.findOne({
            where: { shop_id: shopId, codigo, deleted_at: null },
          })
        : null;

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
      expira_en: JOB_TTL_MS,
    };
  }

  /**
   * HU-13. Aplica el lote previsualizado. Atómico: se aplica todo el lote
   * válido o no se aplica nada. Genera un punto de restauración previo.
   */
  async confirmarImportacion(shopId: string, jobId: string) {
    const job = this.importJobs.get(jobId);
    if (!job || job.expira < Date.now()) {
      throw new GoneException({
        error: 'JOB_EXPIRADO',
        mensaje: 'La importación expiró o no existe',
      });
    }
    if (job.shopId !== shopId) throw new NotFoundException('Importación no encontrada');
    this.importJobs.delete(jobId);

    const validas = job.filas.filter((f) => !f.error);
    if (job.conError > 0) {
      throw new UnprocessableEntityException({
        error: 'LOTE_CON_ERRORES',
        mensaje: `Hay ${job.conError} fila(s) con error. Corrija el archivo e importe de nuevo.`,
        filas_con_error: job.filas.filter((f) => f.error).map((f) => ({ fila: f.fila, error: f.error })),
      });
    }

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

    let aplicados = 0;
    try {
      for (const f of validas) {
        const existente = await this.apuRepo.findOne({
          where: { shop_id: shopId, codigo: f.codigo, deleted_at: null },
        });

        if (existente) {
          existente.descripcion = f.descripcion;
          existente.unidad = f.unidad;
          if (f.chapter_id !== undefined) existente.chapter_id = f.chapter_id;
          existente.version = existente.version + 1;
          await this.apuRepo.save(existente);
          await this.componentRepo.delete({ apu_id: existente.id });
          if (f.componentes.length) {
            await this.componentRepo.save(
              f.componentes.map((c) =>
                this.componentRepo.create({
                  apu_id: existente.id,
                  insumo_id: c.insumo_id,
                  rendimiento: c.rendimiento,
                }),
              ),
            );
          }
        } else {
          const apu = this.apuRepo.create({
            shop_id: shopId,
            chapter_id: f.chapter_id,
            codigo: f.codigo,
            descripcion: f.descripcion,
            unidad: f.unidad,
            origen: OrigenApu.IMPORTADO,
            version: 1,
          });
          const guardado = await this.apuRepo.save(apu);
          if (f.componentes.length) {
            await this.componentRepo.save(
              f.componentes.map((c) =>
                this.componentRepo.create({
                  apu_id: guardado.id,
                  insumo_id: c.insumo_id,
                  rendimiento: c.rendimiento,
                }),
              ),
            );
          }
        }
        aplicados += 1;
      }
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
      const codigosNuevos = validas
        .filter((f) => !previos.some((p) => p.codigo === f.codigo))
        .map((f) => f.codigo);
      if (codigosNuevos.length) {
        const creados = await this.apuRepo.find({
          where: { shop_id: shopId, codigo: In(codigosNuevos), origen: OrigenApu.IMPORTADO },
        });
        for (const c of creados) {
          await this.componentRepo.delete({ apu_id: c.id });
          await this.apuRepo.delete({ id: c.id });
        }
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