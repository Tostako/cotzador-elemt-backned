import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TileProject } from '../entities/tile-project.entity';
import { CreateProjectDto, UpdateProjectDto } from './tile-calculator.dto';

interface Ctx { shop_id: string; customer_id: string; }

export interface ProjectSummary {
  id: string;
  nombre: string;
  propietario: string | null;
  ubicacion: string | null;
  niveles_count: number;
  espacios_count: number;
  materiales_count: number;
  total_presupuesto: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class TileCalculatorService {
  constructor(
    @InjectRepository(TileProject) private readonly projects: Repository<TileProject>,
  ) {}

  private toSummary(p: TileProject): ProjectSummary {
    const nivelesCount = Array.isArray(p.niveles) ? p.niveles.length : 0;
    const espaciosCount = Array.isArray(p.niveles)
      ? p.niveles.reduce((sum, n) => sum + (Array.isArray(n.espacios) ? n.espacios.length : 0), 0)
      : 0;
    const materialesCount = Array.isArray(p.materiales) ? p.materiales.length : 0;

    const totalPresupuesto = Array.isArray(p.materiales)
      ? p.materiales.reduce((sum, m) => {
          const precio = m.modo_precio === 'caja' ? (m.precio_caja ?? 0) : (m.precio_m2 ?? 0);
          return sum + precio;
        }, 0)
      : 0;

    return {
      id: p.id,
      nombre: p.nombre,
      propietario: p.propietario,
      ubicacion: p.ubicacion,
      niveles_count: nivelesCount,
      espacios_count: espaciosCount,
      materiales_count: materialesCount,
      total_presupuesto: totalPresupuesto,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  async findAll(ctx: Ctx): Promise<ProjectSummary[]> {
    const rows = await this.projects.find({
      where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id },
      order: { created_at: 'DESC' },
    });
    return rows.map((r) => this.toSummary(r));
  }

  async findOne(ctx: Ctx, id: string): Promise<TileProject> {
    const p = await this.projects.findOne({
      where: { id, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return p;
  }

  async create(ctx: Ctx, dto: CreateProjectDto): Promise<TileProject> {
    const project = this.projects.create({
      ...dto,
      shop_id: ctx.shop_id,
      customer_id: ctx.customer_id,
      niveles: [
        {
          id: crypto.randomUUID(),
          nombre: 'Piso 1',
          espacios: [],
          conexiones: [],
        },
      ],
      materiales: [],
      banco_sobrantes: [],
    });
    return this.projects.save(project);
  }

  async update(ctx: Ctx, id: string, dto: UpdateProjectDto): Promise<TileProject> {
    const project = await this.findOne(ctx, id);
    Object.assign(project, dto);
    return this.projects.save(project);
  }

  async remove(ctx: Ctx, id: string): Promise<{ ok: true }> {
    await this.findOne(ctx, id);
    await this.projects.delete({ id });
    return { ok: true };
  }
}
