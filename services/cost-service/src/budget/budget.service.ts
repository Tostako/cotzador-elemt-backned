import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Project } from '../entities/project.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Apu, OrigenApu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { Supply } from '../entities/supply.entity';
import { BudgetEvent, BudgetEventState } from '../entities/budget-event.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { AddItemDto, UpdateItemDto, EditarApuSnapshotDto } from './budget.dto';
import { fromCents, toCents } from '../common/money';
import {
  firmarConfirmacion,
  confirmacionValidaParaDatos,
} from '../common/confirmation-token';

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

  // ---- Fase 3: instantánea de APU con alcance de proyecto (HU-11) -------

  private async obtenerItem(shopId: string, customerId: string, projectId: string, itemId: string) {
    const project = await this.obtenerProyecto(shopId, customerId, projectId);
    const item = await this.itemRepo.findOne({
      where: { id: itemId, project_id: project.id, deleted_at: null },
    });
    if (!item) throw new NotFoundException('Item no encontrado');
    return { project, item };
  }

  private etagDeSnapshot(item: BudgetItem): string {
    return `"${Buffer.from(`${item.id}:${item.updated_at.toISOString()}`).toString('base64')}"`;
  }

  /** Normaliza el snapshot congelado al contrato ApuSnapshot. */
  private async snapshotContrato(project: Project, item: BudgetItem) {
    const snap = item.apu_snapshot;
    const componentes = (snap.componentes ?? []).map((c) => ({
      insumo_id: c.insumo_id,
      descripcion: c.descripcion,
      grupo: c.grupo,
      unidad: c.unidad,
      rendimiento: c.rendimiento,
      costo_unitario: c.subtotal ?? '0.00',
      subtotal: c.subtotal ?? '0.00',
    }));

    const desglose = { materiales: '0.00', mano_obra: '0.00', equipo: '0.00' };
    for (const c of componentes) {
      const cents = toCents(c.subtotal);
      if (c.grupo === 'MATERIAL') desglose.materiales = fromCents(toCents(desglose.materiales) + cents);
      else if (c.grupo === 'MANO_OBRA') desglose.mano_obra = fromCents(toCents(desglose.mano_obra) + cents);
      else if (c.grupo === 'EQUIPO') desglose.equipo = fromCents(toCents(desglose.equipo) + cents);
    }

    // divergencia contra el catálogo global
    let divergeDelCatalogo = false;
    if (item.apu_id) {
      const global = await this.apuRepo.findOne({ where: { id: item.apu_id, shop_id: project.shop_id, deleted_at: null } });
      if (!global) {
        divergeDelCatalogo = true;
      } else {
        const calcGlobal = await this.costEngine.costoApu(global.id);
        divergeDelCatalogo = toCents(calcGlobal.costo_unitario) !== toCents(item.valor_unitario);
      }
    }

    return {
      snapshot_id: item.id,
      descripcion: snap.descripcion,
      unidad: snap.unidad,
      costo_unitario: fromCents(toCents(item.valor_unitario ?? snap.valor_unitario)),
      desglose,
      componentes,
      apu_origen_id: snap.apu_id ?? item.apu_id ?? null,
      diverge_del_catalogo: divergeDelCatalogo,
      version: snap.version,
      etag: this.etagDeSnapshot(item),
    };
  }

  /**
   * HU-11. Instantánea del APU de la actividad (solo lectura del proyecto).
   */
  async obtenerApuSnapshot(shopId: string, customerId: string, projectId: string, itemId: string) {
    const { project, item } = await this.obtenerItem(shopId, customerId, projectId, itemId);
    if (!item.apu_snapshot) throw new NotFoundException('El item no tiene APU asociado');
    return this.snapshotContrato(project, item);
  }

  /**
   * HU-11, decisión H-07. Edita SOLO la instantánea del proyecto; el catálogo
   * global no se altera y ningún otro proyecto se ve afectado.
   */
  async editarApuSnapshot(
    shopId: string,
    customerId: string,
    projectId: string,
    itemId: string,
    dto: EditarApuSnapshotDto,
    ifMatch?: string,
    usuario?: string,
  ) {
    const { project, item } = await this.obtenerItem(shopId, customerId, projectId, itemId);
    if (!item.apu_snapshot) throw new NotFoundException('El item no tiene APU asociado');

    if (ifMatch && ifMatch !== this.etagDeSnapshot(item)) {
      throw new BadRequestException({
        error: 'VERSION_CONFLICT',
        mensaje: 'La instantánea fue modificada por otra persona',
      });
    }

    const snap = item.apu_snapshot;
    const antes = await this.snapState(project.id, project.version);

    const descripcion = dto.descripcion ?? snap.descripcion;
    let componentes = snap.componentes;

    if (dto.componentes) {
      const ids = dto.componentes.map((c) => c.insumo_id);
      const insumos = ids.length ? await this.supplyRepo.find({ where: { id: In(ids) } }) : [];
      const avisos = [];
      let costo = 0;
      const nuevos = [];

      for (const c of dto.componentes) {
        const insumo = insumos.find((s) => s.id === c.insumo_id);
        if (!insumo) {
          throw new BadRequestException({
            error: 'INSUMO_INVALIDO',
            mensaje: `El insumo ${c.insumo_id} no existe en el maestro`,
          });
        }
        const precio = await this.costEngine.precioVigente(c.insumo_id);
        const subtotalCents = Math.round(toCents(precio.valor) * c.rendimiento);
        costo += subtotalCents;
        if (!precio.existe) {
          avisos.push({
            tipo: 'ADVERTENCIA',
            codigo: 'INSUMO_SIN_PRECIO',
            mensaje: `El insumo "${insumo.descripcion}" no tiene precio; se usa 0.00`,
          });
        }
        nuevos.push({
          insumo_id: c.insumo_id,
          descripcion: insumo.descripcion,
          unidad: insumo.unidad,
          grupo: insumo.grupo,
          rendimiento: String(c.rendimiento),
          valor: precio.valor,
          subtotal: fromCents(subtotalCents),
        });
      }

      componentes = nuevos;
      item.valor_unitario = fromCents(costo);
    }

    snap.descripcion = descripcion;
    snap.componentes = componentes;
    snap.version = (snap.version ?? 1) + 1;
    snap.capturado_en = new Date().toISOString();
    snap.valor_unitario = item.valor_unitario ?? snap.valor_unitario;
    item.apu_snapshot = snap;
    await this.itemRepo.save(item);

    const despues = await this.snapState(project.id, project.version);
    await this.registrarEvento(project.id, 'ITEM_APU_EDIT', antes, despues, usuario);

    return this.snapshotContrato(project, item);
  }

  /** Conteo de proyectos que usan el APU. */
  private async usoApu(apuId: string) {
    const items = await this.itemRepo.find({ where: { apu_id: apuId, deleted_at: null } });
    if (!items.length) return { proyectosActivos: 0, borrador: 0, aprobado: 0 };
    const ids = [...new Set(items.map((i) => i.project_id))];
    const proyectos = ids.length
      ? await this.projectRepo.find({ where: { id: In(ids), deleted_at: null } })
      : [];
    return {
      proyectosActivos: proyectos.filter((p) => p.estado !== 'ARCHIVADO' && p.estado !== 'PAPELERA').length,
      borrador: proyectos.filter((p) => p.estado === 'BORRADOR').length,
      aprobado: proyectos.filter((p) => p.estado === 'APROBADO').length,
    };
  }

  /**
   * HU-11, decisión H-07. Promueve la versión del proyecto al catálogo global.
   * Requiere perfil admin_catalogo y confirmación de impacto (dryRun primero).
   */
  async promoverApu(
    shopId: string,
    customerId: string,
    projectId: string,
    itemId: string,
    role: string,
    dryRun?: boolean,
    confirmationToken?: string,
  ) {
    if (role !== 'admin_catalogo') {
      throw new ForbiddenException({
        error: 'SIN_PERMISO',
        mensaje: 'Promover un APU al catálogo requiere el perfil admin_catalogo',
      });
    }

    const { project, item } = await this.obtenerItem(shopId, customerId, projectId, itemId);
    if (!item.apu_snapshot) throw new NotFoundException('El item no tiene APU asociado');
    if (!item.apu_id) throw new NotFoundException('El item no referencia un APU del catálogo');

    const apuGlobal = await this.apuRepo.findOne({
      where: { id: item.apu_id, shop_id: project.shop_id, deleted_at: null },
    });
    if (!apuGlobal) throw new NotFoundException('El APU del catálogo fue eliminado');

    const snap = item.apu_snapshot;
    const costoSnapshot = toCents(item.valor_unitario ?? snap.valor_unitario);
    const calcGlobal = await this.costEngine.costoApu(apuGlobal.id);
    const costoGlobal = toCents(calcGlobal.costo_unitario);
    const variacionUnitaria = fromCents(costoSnapshot - costoGlobal);

    const uso = await this.usoApu(apuGlobal.id);
    const data = { snapshot_id: item.id, apu_id: apuGlobal.id };
    const diff = costoSnapshot - costoGlobal;
    const token = diff !== 0
      ? firmarConfirmacion('APU_PROMOTE', project.shop_id, apuGlobal.id, data)
      : null;

    const impacto = {
      proyectos_activos: uso.proyectosActivos,
      presupuestos_borrador: uso.borrador,
      presupuestos_aprobados: uso.aprobado,
      variacion_unitaria: variacionUnitaria,
      confirmation_token: token,
    };

    if (diff === 0) {
      return { ...impacto, publicado: true, sin_cambios: true };
    }

    if (dryRun) {
      return { dry_run: true, ...impacto, confirmado: false };
    }

    if (!confirmacionValidaParaDatos(confirmationToken, 'APU_PROMOTE', project.shop_id, apuGlobal.id, data)) {
      throw new UnprocessableEntityException({
        error: 'CONFIRMACION_REQUERIDA',
        mensaje:
          'Promover este APU cambia el catálogo global. Llame primero con dryRun=true y envíe el X-Confirmation-Token devuelto.',
        impacto: {
          proyectos_activos: uso.proyectosActivos,
          variacion_unitaria: variacionUnitaria,
        },
      });
    }

    // Aplicar: copia la versión del proyecto al catálogo global.
    apuGlobal.descripcion = snap.descripcion;
    apuGlobal.unidad = snap.unidad;
    apuGlobal.version = apuGlobal.version + 1;
    await this.apuRepo.save(apuGlobal);

    await this.compRepo.delete({ apu_id: apuGlobal.id });
    if (snap.componentes?.length) {
      const comps = snap.componentes.map((c) =>
        this.compRepo.create({
          apu_id: apuGlobal.id,
          insumo_id: c.insumo_id,
          rendimiento: c.rendimiento,
        }),
      );
      await this.compRepo.save(comps);
    }

    return { ...impacto, confirmation_token: token, publicado: true };
  }
}