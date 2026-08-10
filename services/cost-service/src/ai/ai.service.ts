import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Apu, OrigenApu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { Supply } from '../entities/supply.entity';
import { Chapter } from '../entities/chapter.entity';
import {
  AiApuProposal,
  ComponentePropuesta,
  EstadoPropuestaApu,
} from '../entities/ai-apu-proposal.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { fromCents, toCents } from '../common/money';

const MAX_COMPONENTES = 6;
const CUOTA_INICIAL = 20;

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(ApuComponent) private readonly apuComponentRepo: Repository<ApuComponent>,
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(Chapter) private readonly chapterRepo: Repository<Chapter>,
    @InjectRepository(AiApuProposal) private readonly proposalRepo: Repository<AiApuProposal>,
    private readonly costEngine: CostEngine,
  ) {}

  // ---- Fase 3: propuestas de APU (HU-24) --------------------------------

  /**
   * Divide la solicitud en términos y busca insumos del shop que coincidan.
   * Modo local: nunca inventa precios; usa el precio vigente del maestro.
   */
  private terminos(solicitud: string): string[] {
    return solicitud
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñü ]/gi, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !['para', 'por', 'con', 'una', 'de', 'del', 'obra', 'mts', 'mt2', 'm2'].includes(t))
      .slice(0, 8);
  }

  /** Genera una propuesta de APU en modo local y la guarda como EN_ESPERA. */
  async proponerApu(shopId: string, solicitud: string, capituloSugerido?: string) {
    if (!solicitud || !solicitud.trim()) {
      throw new HttpException(
        { tipo: 'PETICION_INVALIDA', mensaje: 'La solicitud es obligatoria' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const tokens = this.terminos(solicitud);
    const componentes: ComponentePropuesta[] = [];
    const usados = new Set<string>();

    for (const token of tokens) {
      if (componentes.length >= MAX_COMPONENTES) break;
      const matches = await this.supplyRepo.createQueryBuilder('s')
        .where('s.shop_id = :shopId', { shopId })
        .andWhere('LOWER(s.descripcion) ILIKE :q', { q: `%${token}%` })
        .take(3)
        .getMany();

      for (const insumo of matches) {
        if (usados.has(insumo.id)) continue;
        const precio = await this.costEngine.precioVigente(insumo.id);
        componentes.push({
          insumo_id: insumo.id,
          existe: true,
          rendimiento: 1,
          precio: precio.existe ? fromCents(toCents(precio.valor)) : '0.00',
          nuevo: null,
        });
        usados.add(insumo.id);
        if (componentes.length >= MAX_COMPONENTES) break;
      }
    }

    const costoCalculado = fromCents(
      componentes.reduce((acc, c) => acc + Math.round(toCents(c.precio) * c.rendimiento), 0),
    );

    // Unidad por defecto: la del insumo más relevante o GL si no hay insumos.
    const primeraUnidad = componentes[0]?.nuevo?.unidad ?? null;
    const unidad = primeraUnidad ?? 'GL';

    const cap = capituloSugerido
      ? await this.chapterRepo.findOne({ where: { shop_id: shopId, nombre: capituloSugerido } })
      : null;

    const proposal = this.proposalRepo.create({
      shop_id: shopId,
      solicitud: solicitud.trim().slice(0, 500),
      capitulo_sugerido: cap?.nombre ?? capituloSugerido ?? null,
      descripcion: solicitud.trim().slice(0, 200),
      unidad,
      costo_calculado: costoCalculado,
      componentes,
      cuota_restante: CUOTA_INICIAL,
      estado: EstadoPropuestaApu.EN_ESPERA,
    });
    const saved = await this.proposalRepo.save(proposal);

    return {
      id: saved.id,
      descripcion: saved.descripcion,
      unidad: saved.unidad,
      costo_calculado: saved.costo_calculado,
      componentes: saved.componentes,
      cuota_restante: saved.cuota_restante,
      modo: 'LOCAL',
      aviso: 'Propuesta generada en modo local',
    };
  }

  /**
   * Acepta la propuesta y la incorpora al catálogo con origen GENERADO_IA.
   * Solo aquí se escribe en el catálogo.
   */
  async aceptarPropuesta(shopId: string, proposalId: string) {
    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId, shop_id: shopId },
    });
    if (!proposal) throw new NotFoundException('Propuesta APU no encontrada');

    if (proposal.estado === EstadoPropuestaApu.ACEPTADA) {
      throw new HttpException(
        { tipo: 'CONFLICTO', mensaje: 'La propuesta ya fue aceptada' },
        HttpStatus.CONFLICT,
      );
    }

    const codigo = await this.generarCodigoIap(shopId);

    const apu = this.apuRepo.create({
      shop_id: shopId,
      chapter_id: proposal.capitulo_sugerido
        ? ((await this.chapterRepo.findOne({
            where: { shop_id: shopId, nombre: proposal.capitulo_sugerido },
          }))?.id ?? null)
        : null,
      codigo,
      descripcion: proposal.descripcion,
      unidad: proposal.unidad,
      origen: OrigenApu.GENERADO_IA,
      version: 1,
    });
    const saved = await this.apuRepo.save(apu);

    const existentes = proposal.componentes.filter((c) => c.insumo_id !== null);
    if (existentes.length) {
      const comps = existentes.map((c) =>
        this.apuComponentRepo.create({
          apu_id: saved.id,
          insumo_id: c.insumo_id as string,
          rendimiento: String(c.rendimiento),
        }),
      );
      await this.apuComponentRepo.save(comps);
    }

    proposal.estado = EstadoPropuestaApu.ACEPTADA;
    proposal.accepted_at = new Date();
    await this.proposalRepo.save(proposal);

    const calculo = await this.costEngine.costoApu(saved.id);
    return {
      ...saved,
      componentes: await this.apuComponentRepo.find({ where: { apu_id: saved.id } }),
      costo_unitario: calculo.costo_unitario,
      avisos: calculo.avisos,
    };
  }

  /** Código de APU generado por IA: IA-xxxxx sin colisión activa. */
  private async generarCodigoIap(shopId: string): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const sufijo = Math.random().toString(36).slice(2, 7).toUpperCase();
      const codigo = `IA-${sufijo}`;
      const existe = await this.apuRepo.findOne({
        where: { shop_id: shopId, codigo, deleted_at: null },
      });
      if (!existe) return codigo;
    }
    return `IA-${Date.now().toString(36).toUpperCase()}`;
  }
}