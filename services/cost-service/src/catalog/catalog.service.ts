import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../entities/chapter.entity';
import { Apu, OrigenApu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { CreateChapterDto, UpdateChapterDto, CreateApuDto, UpdateApuDto } from './catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Chapter) private readonly chapterRepo: Repository<Chapter>,
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(ApuComponent) private readonly componentRepo: Repository<ApuComponent>,
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
}