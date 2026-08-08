import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
}