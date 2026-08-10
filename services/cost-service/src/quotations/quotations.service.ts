import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Quotation } from '../entities/quotation.entity';
import {
  QuotationLine,
  EstadoLineaCotizacion,
} from '../entities/quotation-line.entity';
import { Project } from '../entities/project.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Supply } from '../entities/supply.entity';
import { SupplyPrice, OrigenPrecio } from '../entities/supply-price.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { CostEngine } from '../cost-engine/cost-engine.service';
import {
  firmarConfirmacion,
  confirmacionValidaParaDatos,
} from '../common/confirmation-token';
import { fromCents, toCents, parseCantidad } from '../common/money';
import { RegistrarLineaCotizacionDto } from './quotations.dto';

const UMBRAL_VARIACION_PCT = 5;

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation) private readonly quotationRepo: Repository<Quotation>,
    @InjectRepository(QuotationLine) private readonly lineRepo: Repository<QuotationLine>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(SupplyPrice) private readonly priceRepo: Repository<SupplyPrice>,
    private readonly analytics: AnalyticsService,
    private readonly costEngine: CostEngine,
  ) {}

  private async obtenerQuotation(shopId: string, quotationId: string) {
    const quotation = await this.quotationRepo.findOne({ where: { id: quotationId, shop_id: shopId } });
    if (!quotation) throw new NotFoundException('Cotización no encontrada');
    return quotation;
  }

  private async obtenerLinea(quotationId: string, lineId: string) {
    const line = await this.lineRepo.findOne({ where: { id: lineId, quotation_id: quotationId } });
    if (!line) throw new NotFoundException('Línea de cotización no encontrada');
    return line;
  }

  /** Devuelve la cotización con sus líneas normalizadas al contrato del API. */
  private async aContrato(quotation: Quotation) {
    const lineas = await this.lineRepo.find({
      where: { quotation_id: quotation.id },
      order: { created_at: 'ASC' },
    });
    return {
      id: quotation.id,
      creada_en: quotation.creada_en.toISOString(),
      lineas: lineas.map((l) => ({
        id: l.id,
        insumo_id: l.insumo_id,
        descripcion: l.descripcion,
        unidad: l.unidad,
        cantidad_total: Number(l.cantidad_total).toFixed(4),
        precio_presupuestado: fromCents(toCents(l.precio_presupuestado)),
        proveedor: l.proveedor,
        precio_cotizado: l.precio_cotizado !== null ? fromCents(toCents(l.precio_cotizado)) : null,
        estado: l.estado,
      })),
    };
  }

  /**
   * HU-22. Genera una cotización desde el consolidado de materiales. Todas las
   * líneas arrancan en estado PENDIENTE.
   */
  async crear(shopId: string, customerId: string, projectId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId, shop_id: shopId, customer_id: customerId, deleted_at: null },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const consolidado = await this.analytics.consolidado(shopId, customerId, projectId, 'MATERIAL');

    const quotation = this.quotationRepo.create({
      shop_id: shopId,
      project_id: projectId,
      customer_id: customerId,
      creada_en: new Date(),
    });
    const saved = await this.quotationRepo.save(quotation);

    const lineas = consolidado.data.map((r) =>
      this.lineRepo.create({
        quotation_id: saved.id,
        insumo_id: r.insumo_id,
        descripcion: r.descripcion,
        unidad: r.unidad,
        cantidad_total: r.cantidad_total,
        precio_presupuestado: r.valor_unitario,
        estado: EstadoLineaCotizacion.PENDIENTE,
      }),
    );
    await this.lineRepo.save(lineas);

    return this.aContrato(saved);
  }

  /**
   * HU-22. Registra proveedor y precio cotizado en una línea. Calcula la
   * diferencia contra el precio presupuestado y el impacto sobre el proyecto.
   */
  async registrarLinea(
    shopId: string,
    quotationId: string,
    lineId: string,
    dto: RegistrarLineaCotizacionDto,
  ) {
    await this.obtenerQuotation(shopId, quotationId);
    const line = await this.obtenerLinea(quotationId, lineId);

    if (dto.proveedor !== undefined) line.proveedor = dto.proveedor;
    if (dto.precio_cotizado !== undefined) {
      line.precio_cotizado = String(dto.precio_cotizado);
      if (line.estado === EstadoLineaCotizacion.PENDIENTE) {
        line.estado = EstadoLineaCotizacion.COTIZADO;
      }
    }
    if (dto.estado !== undefined) {
      if (dto.estado === EstadoLineaCotizacion.COTIZADO && dto.precio_cotizado === undefined && !line.precio_cotizado) {
        throw new UnprocessableEntityException({
          error: 'PRECIO_COTIZADO_REQUERIDO',
          mensaje: 'Debe registrar un precio cotizado antes de marcar la línea como COTIZADO',
        });
      }
      line.estado = dto.estado;
    }
    await this.lineRepo.save(line);

    const presupuestadoCents = toCents(line.precio_presupuestado);
    const cotizadoCents = line.precio_cotizado !== null ? toCents(line.precio_cotizado) : presupuestadoCents;
    const diferenciaCents = cotizadoCents - presupuestadoCents;
    const cantidad = parseCantidad(line.cantidad_total);
    const diferenciaPct = presupuestadoCents !== 0
      ? Number(((cotizadoCents - presupuestadoCents) / presupuestadoCents * 100).toFixed(2))
      : 0;
    const impactoProyectoCents = Math.round(diferenciaCents * cantidad);

    return {
      id: line.id,
      estado: line.estado,
      diferencia: fromCents(diferenciaCents),
      diferencia_pct: diferenciaPct,
      impacto_proyecto: fromCents(impactoProyectoCents),
    };
  }

  /** Conteo de proyectos que usan el insumo (por snapshot de componentes). */
  private async usoInsumo(insumoId: string): Promise<{
    apusCount: number;
    proyectosActivos: number;
    borrador: number;
    aprobado: number;
  }> {
    const items = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.apu_snapshot @> :filtro', {
        filtro: JSON.stringify({ componentes: [{ insumo_id: insumoId }] }),
      })
      .getMany();

    const projectIds = [...new Set(items.map((i) => i.project_id))];
    const proyectos = projectIds.length
      ? await this.projectRepo.find({ where: { id: In(projectIds) } })
      : [];

    const apus = items.filter((i) => i.apu_snapshot?.apu_id);
    const apusCount = new Set(apus.map((i) => i.apu_snapshot.apu_id)).size;

    const activos = proyectos.filter((p) => p.estado !== 'ARCHIVADO' && p.estado !== 'PAPELERA');
    const borrador = proyectos.filter((p) => p.estado === 'BORRADOR').length;
    const aprobado = proyectos.filter((p) => p.estado === 'APROBADO').length;

    return { apusCount, proyectosActivos: activos.length, borrador, aprobado };
  }

  /**
   * HU-22. Lleva el precio cotizado al maestro de insumos con el mismo patrón
   * de confirmación de impacto que el cambio de precio directo. El historial
   * registra que el cambio vino de esta cotización (origen COTIZACION).
   */
  async aplicarPrecioCotizado(
    shopId: string,
    quotationId: string,
    lineId: string,
    usuario: string,
    dryRun?: boolean,
    confirmationToken?: string,
  ) {
    await this.obtenerQuotation(shopId, quotationId);
    const line = await this.obtenerLinea(quotationId, lineId);

    if (!line.precio_cotizado) {
      throw new UnprocessableEntityException({
        error: 'PRECIO_COTIZADO_REQUERIDO',
        mensaje: 'Esta línea aún no tiene un precio cotizado que aplicar',
      });
    }

    const supply = await this.supplyRepo.findOne({ where: { id: line.insumo_id, shop_id: shopId } });
    if (!supply) throw new NotFoundException('Insumo no encontrado');

    const vigente = await this.costEngine.precioVigente(supply.id);
    const valorActualCents = vigente.existe ? toCents(vigente.valor) : 0;
    const valorPropuestoCents = toCents(line.precio_cotizado);
    const variacionCents = valorPropuestoCents - valorActualCents;
    const variacionPct = valorActualCents !== 0
      ? Number(((valorPropuestoCents - valorActualCents) / valorActualCents * 100).toFixed(2))
      : valorPropuestoCents > 0 ? 100 : 0;
    const superaUmbral = Math.abs(variacionPct) > UMBRAL_VARIACION_PCT;

    const uso = await this.usoInsumo(supply.id);
    const cantidad = parseCantidad(line.cantidad_total);
    const variacionTotalCents = Math.round(variacionCents * cantidad);

    const impacto = {
      valor_actual: fromCents(valorActualCents),
      valor_propuesto: fromCents(valorPropuestoCents),
      variacion_pct: variacionPct,
      supera_umbral: superaUmbral,
      apus: uso.apusCount,
      variacion_total_estimada: fromCents(variacionTotalCents),
      proyectos_activos: uso.proyectosActivos,
      presupuestos_borrador: uso.borrador,
      presupuestos_aprobados: uso.aprobado,
      variacion_unitaria: fromCents(variacionCents),
    };

    const diff = valorPropuestoCents - valorActualCents;
    if (diff === 0) {
      // Mismo precio: no requiere confirmación, solo devuelve el análisis.
      return impacto;
    }

    const data = { valor: line.precio_cotizado, quotation_id: quotationId, line_id: lineId };
    const token = firmarConfirmacion('PRECIO_EDIT', shopId, supply.id, data);
    const impactoFull = { ...impacto, confirmation_token: token };

    if (dryRun) {
      return { dry_run: true, ...impactoFull, confirmado: false };
    }

    if (!confirmacionValidaParaDatos(confirmationToken, 'PRECIO_EDIT', shopId, supply.id, data)) {
      throw new UnprocessableEntityException({
        error: 'CONFIRMACION_REQUERIDA',
        mensaje:
          'Este precio cambia el costo del proyecto. Llame primero con dryRun=true y envíe el X-Confirmation-Token devuelto.',
        impacto: {
          proyectos_activos: impacto.proyectos_activos,
          variacion_unitaria: impacto.variacion_unitaria,
        },
      });
    }

    const price = this.priceRepo.create({
      supply_id: supply.id,
      valor: line.precio_cotizado,
      vigente_desde: new Date(),
      usuario,
      motivo: `Precio aplicado desde cotización (línea ${line.id.slice(0, 8)})`,
      origen: OrigenPrecio.COTIZACION,
    });
    await this.priceRepo.save(price);

    return { ...impacto, confirmation_token: token, aplicado: true, precio: fromCents(valorPropuestoCents) };
  }
}