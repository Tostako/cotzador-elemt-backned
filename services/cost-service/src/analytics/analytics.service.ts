import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Chapter } from '../entities/chapter.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { fromCents } from '../common/money';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(Chapter) private readonly chapterRepo: Repository<Chapter>,
    private readonly costEngine: CostEngine,
  ) {}

  private async obtenerProyecto(shopId: string, customerId: string, projectId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId, shop_id: shopId, customer_id: customerId, deleted_at: null },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  private etagDe(project: Project, itemsLength: number) {
    const etag = `${project.version}-${itemsLength}-${project.updated_at.toISOString()}`;
    return `"${Buffer.from(etag).toString('base64')}"`;
  }

  /** Resumen del panel: costos, AIU e IVA. Recalcado al vuelo. */
  async resumen(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const calculo = await this.costEngine.calcularProyecto(project);
    const itemsCount = calculo.items.length;

    return {
      project: {
        id: project.id,
        nombre: project.nombre,
        estado: project.estado,
        version: project.version,
      },
      costo_directo: calculo.costo_directo,
      aiu_desglose: calculo.aiu_desglose,
      iva: calculo.iva,
      total: calculo.total,
      capitulos: calculo.capitulos,
      items_count: itemsCount,
      computed_at: new Date().toISOString(),
      etag: this.etagDe(project, itemsCount),
    };
  }

  /** Etag solo para validar If-None-Match sin recalcular. */
  async etagActual(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const items = await this.itemRepo.count({ where: { project_id: project.id, deleted_at: null } });
    return this.etagDe(project, items);
  }

  /** Distribución por capítulos. */
  async porCapitulos(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const calculo = await this.costEngine.calcularProyecto(project);
    return calculo.capitulos;
  }
}