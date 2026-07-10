import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuardaescobasProject, GuardaescobasMaterial, GuardaescobasResultado } from '../entities/guardaescobas-project.entity';
import { Nivel, Espacio, Segmento } from '../common/house-plan.interfaces';
import { CreateGuardaescobasProjectDto, UpdateGuardaescobasProjectDto } from './guardaescobas.dto';

interface Ctx { shop_id: string; customer_id: string; }

@Injectable()
export class GuardaescobasService {
  constructor(
    @InjectRepository(GuardaescobasProject) private readonly projects: Repository<GuardaescobasProject>,
  ) {}

  async findAll(ctx: Ctx): Promise<GuardaescobasProject[]> {
    return this.projects.find({
      where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(ctx: Ctx, id: string): Promise<GuardaescobasProject> {
    const p = await this.projects.findOne({
      where: { id, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!p) throw new NotFoundException('Proyecto de guarda escobas no encontrado');
    return p;
  }

  async create(ctx: Ctx, dto: CreateGuardaescobasProjectDto): Promise<GuardaescobasProject> {
    const project = this.projects.create({
      ...dto,
      shop_id: ctx.shop_id,
      customer_id: ctx.customer_id,
      niveles: [],
      materiales: [],
      resultados: {},
    });
    return this.projects.save(project);
  }

  async update(ctx: Ctx, id: string, dto: UpdateGuardaescobasProjectDto): Promise<GuardaescobasProject> {
    const project = await this.findOne(ctx, id);
    Object.assign(project, dto);
    return this.projects.save(project);
  }

  async remove(ctx: Ctx, id: string): Promise<{ ok: true }> {
    await this.findOne(ctx, id);
    await this.projects.delete({ id });
    return { ok: true };
  }

  async calculate(ctx: Ctx, id: string): Promise<GuardaescobasProject> {
    const project = await this.findOne(ctx, id);
    const materiales = Array.isArray(project.materiales) ? project.materiales : [];

    if (materiales.length === 0) {
      throw new NotFoundException('No hay materiales configurados para calcular');
    }

    // Usamos el primer material como default; el frontend puede enviar material_id por espacio si quiere.
    const defaultMaterial = materiales[0];

    const detalle: GuardaescobasResultado['detalle'] = [];
    let totalMetros = 0;
    const salienteCm = Number(project.saliente_columna_cm ?? 0);

    const niveles = Array.isArray(project.niveles) ? project.niveles : [];
    for (const nivel of niveles) {
      const espacios = Array.isArray(nivel.espacios) ? nivel.espacios : [];
      for (const espacio of espacios) {
        const perimetro = this.calcularPerimetro(espacio);
        const material = this.resolveMaterial(espacio, materiales) ?? defaultMaterial;
        const precio = perimetro * material.precio_por_metro;
        detalle.push({
          espacio_id: espacio.id,
          nombre: espacio.nombre,
          perimetro,
          material_id: material.id,
          precio,
        });
        totalMetros += perimetro;
      }
    }

    totalMetros += salienteCm;
    const totalPrecioEspacios = detalle.reduce((sum, d) => sum + d.precio, 0);
    const totalPrecio = totalPrecioEspacios + salienteCm * defaultMaterial.precio_por_metro;

    project.resultados = {
      total_metros: totalMetros,
      total_precio: totalPrecio,
      detalle,
      saliente_columna_cm: salienteCm,
    };

    return this.projects.save(project);
  }

  private calcularPerimetro(espacio: Espacio): number {
    const segmentos = Array.isArray(espacio.segmentos) ? espacio.segmentos : [];
    return segmentos.reduce((sum, s: Segmento) => {
      const largo = Number(s.largo ?? 0);
      const ancho = Number(s.ancho ?? 0);
      return sum + 2 * (largo + ancho);
    }, 0);
  }

  private resolveMaterial(espacio: Espacio, materiales: GuardaescobasMaterial[]): GuardaescobasMaterial | undefined {
    const materialId = (espacio as any).material_id;
    if (!materialId) return undefined;
    return materiales.find((m) => m.id === materialId);
  }
}
