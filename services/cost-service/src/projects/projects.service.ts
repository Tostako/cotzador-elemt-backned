import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, EstadoProyecto } from '../entities/project.entity';
import { AiuConfigDto, CreateProjectDto, UpdateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
  ) {}

  async listar(shopId: string, customerId: string, filtros: {
    estado?: string;
    page?: number;
    per_page?: number;
  }) {
    const page = Math.max(1, Number(filtros.page ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(filtros.per_page ?? 20)));

    const qb = this.projectRepo
      .createQueryBuilder('p')
      .where('p.shop_id = :shopId', { shopId })
      .andWhere('p.customer_id = :customerId', { customerId })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.created_at', 'DESC');

    if (filtros.estado) {
      qb.andWhere('p.estado = :estado', { estado: filtros.estado });
    }

    const [rows, total] = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();

    return {
      items: rows,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    };
  }

  async obtener(shopId: string, customerId: string, id: string) {
    const p = await this.projectRepo.findOne({
      where: { id, shop_id: shopId, customer_id: customerId, deleted_at: null },
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return p;
  }

  async crear(shopId: string, customerId: string, dto: CreateProjectDto) {
    const project = this.projectRepo.create({
      shop_id: shopId,
      customer_id: customerId,
      nombre: dto.nombre,
      cliente: dto.cliente ?? null,
      ubicacion: dto.ubicacion ?? null,
      area_m2: String(dto.area_m2 ?? 0),
      tipo_obra: dto.tipo_obra ?? null,
      fecha: dto.fecha ?? null,
      aiu: dto.aiu ?? {
        pctAdministracion: 10,
        pctImprevistos: 2,
        pctUtilidad: 12,
        ivaAplica: true,
        pctIva: 19,
        baseIva: 'TOTAL',
        descuento: 0,
      },
    });
    return this.projectRepo.save(project);
  }

  async actualizar(shopId: string, customerId: string, id: string, dto: UpdateProjectDto, ifMatch?: string) {
    const project = await this.obtener(shopId, customerId, id);

    if (ifMatch && Number(ifMatch) !== project.version) {
      throw new BadRequestException({
        error: 'VERSION_CONFLICT',
        mensaje: 'El proyecto fue modificado por otra persona',
      });
    }

    if (dto.nombre !== undefined) project.nombre = dto.nombre;
    if (dto.cliente !== undefined) project.cliente = dto.cliente;
    if (dto.ubicacion !== undefined) project.ubicacion = dto.ubicacion;
    if (dto.area_m2 !== undefined) project.area_m2 = String(dto.area_m2);
    if (dto.tipo_obra !== undefined) project.tipo_obra = dto.tipo_obra;
    if (dto.fecha !== undefined) project.fecha = dto.fecha;
    if (dto.estado !== undefined) project.estado = dto.estado;
    if (dto.aiu !== undefined) project.aiu = { ...project.aiu, ...dto.aiu };

    project.version = project.version + 1;
    return this.projectRepo.save(project);
  }

  async actualizarAiu(shopId: string, customerId: string, id: string, dto: AiuConfigDto) {
    const project = await this.obtener(shopId, customerId, id);
    project.aiu = { ...project.aiu, ...dto };
    project.version = project.version + 1;
    return this.projectRepo.save(project);
  }

  async obtenerAiu(shopId: string, customerId: string, id: string) {
    const project = await this.obtener(shopId, customerId, id);
    return project.aiu;
  }

  async eliminar(shopId: string, customerId: string, id: string) {
    const project = await this.obtener(shopId, customerId, id);
    project.estado = EstadoProyecto.PAPELERA;
    project.deleted_at = new Date();
    await this.projectRepo.save(project);
    return { ok: true };
  }

  async restaurar(shopId: string, customerId: string, id: string) {
    const project = await this.projectRepo.findOne({
      where: { id, shop_id: shopId, customer_id: customerId },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    project.estado = EstadoProyecto.BORRADOR;
    project.deleted_at = null;
    return this.projectRepo.save(project);
  }
}