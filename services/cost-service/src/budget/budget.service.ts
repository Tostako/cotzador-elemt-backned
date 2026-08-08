import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Project } from '../entities/project.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Apu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { Supply } from '../entities/supply.entity';
import { BudgetEvent, BudgetEventState } from '../entities/budget-event.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { AddItemDto, UpdateItemDto } from './budget.dto';
import { fromCents, toCents } from '../common/money';

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(ApuComponent) private readonly compRepo: Repository<ApuComponent>,
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(BudgetEvent) private readonly eventRepo: Repository<BudgetEvent>,
    private readonly costEngine: CostEngine,
  ) {}

  private async obtenerProyecto(shopId: string, customerId: string, projectId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId, shop_id: shopId, customer_id: customerId, deleted_at: null },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  private async snapState(projectId: string, version: number): Promise<BudgetEventState> {
    const items = await this.itemRepo.find({
      where: { project_id: projectId },
      order: { created_at: 'ASC' },
    });
    return {
      items: items.map((i) => ({
        id: i.id,
        chapter_id: i.chapter_id,
        apu_id: i.apu_id,
        descripcion: i.descripcion,
        unidad: i.unidad,
        cantidad: i.cantidad,
        valor_unitario: i.valor_unitario,
        deleted_at: i.deleted_at?.toISOString() ?? null,
      })),
      version,
    };
  }

  private async registrarEvento(
    projectId: string,
    tipo: string,
    antes: BudgetEventState,
    despues: BudgetEventState,
    usuario?: string,
  ) {
    const event = this.eventRepo.create({
      project_id: projectId,
      tipo,
      undo_token: randomUUID(),
      estado_antes: antes,
      estado_despues: despues,
      usuario: usuario ?? null,
    });
    await this.eventRepo.save(event);
    return event;
  }

  private async guardarEstado(project: Project, estado: BudgetEventState) {
    const actuales = await this.itemRepo.find({ where: { project_id: project.id } });

    for (const st of estado.items) {
      const item = actuales.find((a) => a.id === st.id) ?? this.itemRepo.create();
      item.project_id = project.id;
      item.id = st.id;
      item.chapter_id = st.chapter_id;
      item.apu_id = st.apu_id;
      item.descripcion = st.descripcion;
      item.unidad = st.unidad;
      item.cantidad = st.cantidad;
      item.valor_unitario = st.valor_unitario;
      item.deleted_at = st.deleted_at ? new Date(st.deleted_at) : null;
      await this.itemRepo.save(item);
    }

    // Borrar items que ya no están en el estado
    for (const a of actuales) {
      if (!estado.items.some((s) => s.id === a.id)) {
        await this.itemRepo.delete({ id: a.id });
      }
    }

    project.version = estado.version;
    await this.projectRepo.save(project);
  }

  /** Agrega un item al presupuesto con snapshot congelado del APU. */
  async agregarItem(
    shopId: string,
    customerId: string,
    projectId: string,
    dto: AddItemDto,
    usuario?: string,
  ) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const apu = await this.apuRepo.findOne({ where: { id: dto.apu_id, shop_id: shopId, deleted_at: null } });
    if (!apu) throw new NotFoundException('APU no encontrado');

    const componentes = await this.compRepo.find({ where: { apu_id: apu.id } });
    const insumos = await this.supplyRepo.findByIds(componentes.map((c) => c.insumo_id));

    const snapshotComponentes = [];
    const avisos = [];
    let costo = 0;

    for (const comp of componentes) {
      const insumo = insumos.find((s) => s.id === comp.insumo_id);
      const precio = await this.costEngine.precioVigente(comp.insumo_id);
      const subtotalCents = Math.round(toCents(precio.valor) * parseFloat(comp.rendimiento));
      costo += subtotalCents;

      if (!precio.existe) {
        avisos.push({
          tipo: 'ADVERTENCIA',
          codigo: 'INSUMO_SIN_PRECIO',
          mensaje: `El insumo "${insumo?.descripcion ?? '?'}" no tiene precio; se usa 0.00`,
        });
      } else if (precio.historico) {
        avisos.push({
          tipo: 'ADVERTENCIA',
          codigo: 'PRECIO_HISTORICO',
          mensaje: `El insumo "${insumo?.descripcion ?? '?'}" usa precio histórico`,
        });
      }

      snapshotComponentes.push({
        insumo_id: comp.insumo_id,
        descripcion: insumo?.descripcion ?? '',
        unidad: insumo?.unidad ?? '',
        grupo: insumo?.grupo ?? '',
        rendimiento: comp.rendimiento,
        valor: precio.valor,
        subtotal: fromCents(subtotalCents),
      });
    }

    const valorUnitario = fromCents(costo);

    const antes = await this.snapState(project.id, project.version);
    const item = this.itemRepo.create({
      project_id: project.id,
      chapter_id: dto.chapter_id ?? null,
      apu_id: apu.id,
      apu_snapshot: {
        apu_id: apu.id,
        codigo: apu.codigo,
        descripcion: apu.descripcion,
        unidad: apu.unidad,
        valor_unitario: valorUnitario,
        componentes: snapshotComponentes,
        version: apu.version,
        capturado_en: new Date().toISOString(),
      },
      descripcion: dto.apu_id ? apu.descripcion : apu.descripcion,
      unidad: apu.unidad,
      cantidad: String(dto.cantidad),
      valor_unitario: valorUnitario,
    });
    const saved = await this.itemRepo.save(item);

    const despues = await this.snapState(project.id, project.version);
    const event = await this.registrarEvento(project.id, 'ITEM_ADD', antes, despues, usuario);

    return {
      item: saved,
      costo_unitario: valorUnitario,
      avisos,
      undo_token: event.undo_token,
    };
  }

  async actualizarItem(
    shopId: string,
    customerId: string,
    projectId: string,
    itemId: string,
    dto: UpdateItemDto,
    usuario?: string,
  ) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const item = await this.itemRepo.findOne({ where: { id: itemId, project_id: project.id } });
    if (!item) throw new NotFoundException('Item no encontrado');

    const antes = await this.snapState(project.id, project.version);

    if (dto.cantidad !== undefined) item.cantidad = String(dto.cantidad);
    if (dto.chapter_id !== undefined) item.chapter_id = dto.chapter_id;
    if (dto.descripcion !== undefined) item.descripcion = dto.descripcion;
    await this.itemRepo.save(item);

    const despues = await this.snapState(project.id, project.version);
    const event = await this.registrarEvento(project.id, 'ITEM_UPDATE', antes, despues, usuario);
    return { item, undo_token: event.undo_token };
  }

  async eliminarItem(
    shopId: string,
    customerId: string,
    projectId: string,
    itemId: string,
    usuario?: string,
  ) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const item = await this.itemRepo.findOne({ where: { id: itemId, project_id: project.id } });
    if (!item) throw new NotFoundException('Item no encontrado');

    const antes = await this.snapState(project.id, project.version);
    item.deleted_at = new Date();
    await this.itemRepo.save(item);

    const despues = await this.snapState(project.id, project.version);
    const event = await this.registrarEvento(project.id, 'ITEM_DELETE', antes, despues, usuario);
    return { ok: true, undo_token: event.undo_token };
  }

  /** Deshace una operación vía undo_token. */
  async deshacer(shopId: string, customerId: string, undoToken: string) {
    const event = await this.eventRepo.findOne({
      where: { undo_token: undoToken, undone_at: IsNull() },
    });
    if (!event) throw new NotFoundException('Operación no encontrada o ya deshecha');

    const project = await this.projectRepo.findOne({
      where: { id: event.project_id, shop_id: shopId, customer_id: customerId },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    await this.guardarEstado(project, event.estado_antes);
    event.undone_at = new Date();
    await this.eventRepo.save(event);

    return { ok: true, undone: true };
  }

  async listarItems(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const items = await this.itemRepo.find({
      where: { project_id: project.id, deleted_at: null },
      order: { created_at: 'ASC' },
    });
    const calculo = await this.costEngine.calcularProyecto(project);
    return { items, ...calculo };
  }

  async validar(shopId: string, customerId: string, projectId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const items = await this.itemRepo.find({ where: { project_id: project.id, deleted_at: null } });

    const avisos = [];
    if (items.length === 0) {
      avisos.push({ tipo: 'ADVERTENCIA', codigo: 'SIN_ITEMS', mensaje: 'El presupuesto no tiene items' });
    }

    for (const item of items) {
      if (parseFloat(item.cantidad) <= 0) {
        avisos.push({
          tipo: 'ADVERTENCIA',
          codigo: 'CANTIDAD_INVALIDA',
          mensaje: `El item "${item.descripcion}" tiene cantidad 0`,
          field: `items.${item.id}.cantidad`,
        });
      }
      const insumosSinPrecio = (item.apu_snapshot.componentes ?? []).filter((c) => parseFloat(c.valor) === 0);
      if (insumosSinPrecio.length > 0) {
        avisos.push({
          tipo: 'ADVERTENCIA',
          codigo: 'INSUMOS_SIN_PRECIO',
          mensaje: `El item "${item.descripcion}" tiene ${insumosSinPrecio.length} insumo(s) sin precio`,
          field: `items.${item.id}`,
        });
      }
    }

    const calculo = await this.costEngine.calcularProyecto(project);
    const errores = avisos.filter((a) => a.tipo === 'ERROR');
    const validacion = {
      valido: errores.length === 0,
      errores,
      avisos: avisos.filter((a) => a.tipo !== 'ERROR'),
      total: calculo.total,
      costo_directo: calculo.costo_directo,
    };
    return validacion;
  }
}