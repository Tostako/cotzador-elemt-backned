import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CornisasProject, CornisasMaterial, CornisasResultado } from '../entities/cornisas-project.entity';
import { Nivel, Espacio, Segmento } from '../common/house-plan.interfaces';
import { CreateCornisasProjectDto, UpdateCornisasProjectDto } from './cornisas.dto';

interface Ctx { shop_id: string; customer_id: string; }

@Injectable()
export class CornisasService {
  constructor(
    @InjectRepository(CornisasProject) private readonly projects: Repository<CornisasProject>,
  ) {}

  async findAll(ctx: Ctx): Promise<CornisasProject[]> {
    return this.projects.find({
      where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(ctx: Ctx, id: string): Promise<CornisasProject> {
    const p = await this.projects.findOne({
      where: { id, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!p) throw new NotFoundException('Proyecto de cornisas no encontrado');
    return p;
  }

  async create(ctx: Ctx, dto: CreateCornisasProjectDto): Promise<CornisasProject> {
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

  async update(ctx: Ctx, id: string, dto: UpdateCornisasProjectDto): Promise<CornisasProject> {
    const project = await this.findOne(ctx, id);
    Object.assign(project, dto);
    return this.projects.save(project);
  }

  async remove(ctx: Ctx, id: string): Promise<{ ok: true }> {
    await this.findOne(ctx, id);
    await this.projects.delete({ id });
    return { ok: true };
  }

  async calculate(ctx: Ctx, id: string): Promise<CornisasProject> {
    const project = await this.findOne(ctx, id);
    const materiales = Array.isArray(project.materiales) ? project.materiales : [];

    if (materiales.length === 0) {
      throw new NotFoundException('No hay materiales configurados para calcular');
    }

    const defaultMaterial = materiales[0];

    const detalle: CornisasResultado['detalle'] = [];
    let totalMetros = 0;

    const niveles = Array.isArray(project.niveles) ? project.niveles : [];
    for (const nivel of niveles) {
      const espacios = Array.isArray(nivel.espacios) ? nivel.espacios : [];
      for (const espacio of espacios) {
        const perimetro = this.calcularPerimetro(espacio);
        const material = this.resolveMaterial(espacio, materiales) ?? defaultMaterial;
        const { tiras, precio } = this.calcularPrecio(perimetro, material);
        detalle.push({
          espacio_id: espacio.id,
          nombre: espacio.nombre,
          perimetro,
          material_id: material.id,
          modo: material.modo,
          tiras,
          precio,
        });
        totalMetros += perimetro;
      }
    }

    const totalPrecio = detalle.reduce((sum, d) => sum + d.precio, 0);

    project.resultados = {
      total_metros: totalMetros,
      total_precio: totalPrecio,
      detalle,
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

  private calcularPrecio(
    perimetro: number,
    material: CornisasMaterial,
  ): { tiras: number; precio: number } {
    if (material.modo === 'tira') {
      const largoMetros = Number(material.largo_cm ?? 0) / 100;
      const tiras = largoMetros > 0 ? Math.ceil(perimetro / largoMetros) : 0;
      return { tiras, precio: tiras * Number(material.precio_por_tira ?? 0) };
    }
    return { tiras: 0, precio: perimetro * Number(material.precio_por_metro ?? 0) };
  }

  private resolveMaterial(espacio: Espacio, materiales: CornisasMaterial[]): CornisasMaterial | undefined {
    const materialId = (espacio as any).material_id;
    if (!materialId) return undefined;
    return materiales.find((m) => m.id === materialId);
  }
}
