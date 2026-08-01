import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HousePlan } from '../entities/house-plan.entity';
import { TileProject } from '../entities/tile-project.entity';
import { GuardaescobasProject } from '../entities/guardaescobas-project.entity';
import { CornisasProject } from '../entities/cornisas-project.entity';
import { CreateHousePlanDto, UpdateHousePlanDto, ImportProjectDto } from './house-plans.dto';

interface Ctx { shop_id: string; customer_id: string; }

@Injectable()
export class HousePlansService {
  constructor(
    @InjectRepository(HousePlan) private readonly plans: Repository<HousePlan>,
    @InjectRepository(TileProject) private readonly tileProjects: Repository<TileProject>,
    @InjectRepository(GuardaescobasProject) private readonly guardaescobasProjects: Repository<GuardaescobasProject>,
    @InjectRepository(CornisasProject) private readonly cornisasProjects: Repository<CornisasProject>,
  ) {}

  async findAll(ctx: Ctx): Promise<HousePlan[]> {
    return this.plans.find({
      where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(ctx: Ctx, id: string): Promise<HousePlan> {
    const plan = await this.plans.findOne({
      where: { id, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!plan) throw new NotFoundException('Plano no encontrado');
    return plan;
  }

  async create(ctx: Ctx, dto: CreateHousePlanDto): Promise<HousePlan> {
    const niveles = Array.isArray(dto.niveles)
      ? dto.niveles.map((n) => ({
          ...n,
          espacios: Array.isArray(n.espacios) ? n.espacios : [],
          conexiones: Array.isArray(n.conexiones) ? n.conexiones : [],
        }))
      : [];
    const plan = this.plans.create({
      ...dto,
      niveles,
      shop_id: ctx.shop_id,
      customer_id: ctx.customer_id,
    });
    return this.plans.save(plan);
  }

  async update(ctx: Ctx, id: string, dto: UpdateHousePlanDto): Promise<HousePlan> {
    const plan = await this.findOne(ctx, id);
    const updates: Partial<HousePlan> = { ...dto };
    if (Array.isArray(dto.niveles)) {
      updates.niveles = dto.niveles.map((n) => ({
        ...n,
        espacios: Array.isArray(n.espacios) ? n.espacios : [],
        conexiones: Array.isArray(n.conexiones) ? n.conexiones : [],
      }));
    }
    Object.assign(plan, updates);
    return this.plans.save(plan);
  }

  async remove(ctx: Ctx, id: string): Promise<{ ok: true }> {
    await this.findOne(ctx, id);
    await this.plans.delete({ id });
    return { ok: true };
  }

  async importToTiles(ctx: Ctx, planId: string, dto: ImportProjectDto): Promise<TileProject> {
    const plan = await this.findOne(ctx, planId);
    const project = this.tileProjects.create({
      shop_id: ctx.shop_id,
      customer_id: ctx.customer_id,
      house_plan_id: plan.id,
      nombre: dto.nombre,
      propietario: plan.propietario,
      ubicacion: plan.ubicacion,
      niveles: this.normalizeNiveles(plan.niveles),
      materiales: [],
      banco_sobrantes: [],
    });
    return this.tileProjects.save(project);
  }

  async importToGuardaescobas(ctx: Ctx, planId: string, dto: ImportProjectDto): Promise<GuardaescobasProject> {
    const plan = await this.findOne(ctx, planId);
    const project = this.guardaescobasProjects.create({
      shop_id: ctx.shop_id,
      customer_id: ctx.customer_id,
      house_plan_id: plan.id,
      nombre: dto.nombre,
      niveles: this.normalizeNiveles(plan.niveles),
      materiales: [],
      resultados: {},
    });
    return this.guardaescobasProjects.save(project);
  }

  async syncToTiles(ctx: Ctx, planId: string, projectId: string): Promise<TileProject> {
    const plan = await this.findOne(ctx, planId);
    const project = await this.tileProjects.findOne({
      where: { id: projectId, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!project) throw new NotFoundException('Proyecto de enchapes no encontrado');
    project.niveles = this.normalizeNiveles(plan.niveles);
    return this.tileProjects.save(project);
  }

  async syncToGuardaescobas(ctx: Ctx, planId: string, projectId: string): Promise<GuardaescobasProject> {
    const plan = await this.findOne(ctx, planId);
    const project = await this.guardaescobasProjects.findOne({
      where: { id: projectId, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!project) throw new NotFoundException('Proyecto de guarda escobas no encontrado');
    project.niveles = this.normalizeNiveles(plan.niveles);
    return this.guardaescobasProjects.save(project);
  }

  async importToCornisas(ctx: Ctx, planId: string, dto: ImportProjectDto): Promise<CornisasProject> {
    const plan = await this.findOne(ctx, planId);
    const project = this.cornisasProjects.create({
      shop_id: ctx.shop_id,
      customer_id: ctx.customer_id,
      house_plan_id: plan.id,
      nombre: dto.nombre,
      niveles: this.normalizeNiveles(plan.niveles),
      materiales: [],
      resultados: {},
    });
    return this.cornisasProjects.save(project);
  }

  async syncToCornisas(ctx: Ctx, planId: string, projectId: string): Promise<CornisasProject> {
    const plan = await this.findOne(ctx, planId);
    const project = await this.cornisasProjects.findOne({
      where: { id: projectId, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!project) throw new NotFoundException('Proyecto de cornisas no encontrado');
    project.niveles = this.normalizeNiveles(plan.niveles);
    return this.cornisasProjects.save(project);
  }

  private normalizeNiveles(niveles: any[]): any[] {
    return Array.isArray(niveles)
      ? niveles.map((n) => ({
          ...n,
          espacios: Array.isArray(n.espacios) ? n.espacios : [],
          conexiones: Array.isArray(n.conexiones) ? n.conexiones : [],
        }))
      : [];
  }
}
