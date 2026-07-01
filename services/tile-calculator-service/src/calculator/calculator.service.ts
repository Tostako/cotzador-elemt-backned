import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TileProject } from '../entities/tile-project.entity';
import {
  calcularInstalacion,
  calcularSobrantesEspacio,
  computeArea,
  isContinuo,
  PATRONES,
  PiezasResult,
  InstalacionResult,
  SobrantesResult,
  MaterialInput,
  EspacioInput,
} from './tile-math';
import { CalculateSpaceDto, CalculateOffcutsDto, CalculateProjectDto } from './calculator.dto';

interface Ctx { shop_id: string; customer_id: string; }

export interface SpaceCalculationResponse {
  espacio_area: number;
  material: { id: string; nombre: string; modo_precio: string };
  patron: { id: string; nombre: string; desperdicio_base: number };
  area_necesaria: number;
  area_comprada: number;
  desperdicio_pct: number;
  piezas: number;
  orientacion: string;
  costo_estimado: number;
  cajas_necesarias?: number;
  m2_por_caja?: number;
}

export interface ProjectCalculationResponse {
  proyecto_id: string;
  nombre: string;
  resumen: {
    area_total_necesaria: number;
    area_total_comprada: number;
    costo_total_estimado: number;
    piezas_totales: number;
    espacios_calculados: number;
    espacios_sin_material: number;
  };
  espacios: Array<{
    nivel_id: string;
    nivel_nombre: string;
    espacio_id: string;
    espacio_nombre: string;
    material_id?: string;
    material_nombre?: string;
    area: number;
    costo_estimado: number;
    piezas: number;
  }>;
}

@Injectable()
export class CalculatorService {
  constructor(
    @InjectRepository(TileProject) private readonly projects: Repository<TileProject>,
  ) {}

  getPatterns() {
    return PATRONES.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      desperdicio: p.desperdicio,
      recomendado: p.recomendado,
    }));
  }

  calculateSpace(dto: CalculateSpaceDto): SpaceCalculationResponse {
    const result = calcularInstalacion(
      dto.espacio,
      dto.material,
      dto.patron_id,
      dto.ajuste_desperdicio ?? 0,
    );

    return {
      espacio_area: computeArea(dto.espacio),
      material: { id: dto.material.id, nombre: dto.material.nombre, modo_precio: dto.material.modo_precio },
      patron: {
        id: dto.patron_id,
        nombre: PATRONES.find((p) => p.id === dto.patron_id)?.nombre ?? dto.patron_id,
        desperdicio_base: PATRONES.find((p) => p.id === dto.patron_id)?.desperdicio ?? 5,
      },
      area_necesaria: Number(result.areaNecesaria.toFixed(4)),
      area_comprada: Number(result.areaComprada.toFixed(4)),
      desperdicio_pct: Number(result.desperdicioPct.toFixed(2)),
      piezas: result.piezas,
      orientacion: result.orientacion,
      costo_estimado: Number(result.costoEstimado.toFixed(2)),
      cajas_necesarias: result.cajasNecesarias,
      m2_por_caja: result.m2PorCaja,
    };
  }

  calculateOffcuts(dto: CalculateOffcutsDto): SobrantesResult {
    return calcularSobrantesEspacio(
      dto.espacio,
      dto.material,
      dto.usar_lado_mayor ?? true,
    );
  }

  async calculateProject(
    ctx: Ctx,
    id: string,
    dto: CalculateProjectDto,
  ): Promise<ProjectCalculationResponse> {
    const project = await this.projects.findOne({
      where: { id, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const materialsMap = new Map<string, MaterialInput>();
    for (const m of project.materiales ?? []) {
      materialsMap.set(m.id, m as MaterialInput);
    }

    let areaTotalNecesaria = 0;
    let areaTotalComprada = 0;
    let costoTotal = 0;
    let piezasTotales = 0;
    let espaciosCalculados = 0;
    let espaciosSinMaterial = 0;

    const espaciosResumen: ProjectCalculationResponse['espacios'] = [];

    for (const nivel of project.niveles ?? []) {
      for (const espacio of (nivel as any).espacios ?? []) {
        const espacioInput: EspacioInput = {
          segmentos: (espacio.segmentos ?? []).map((s: any) => ({
            largo: Number(s.largo),
            ancho: Number(s.ancho),
          })),
          tipo: espacio.tipo,
          orientacion_manual: espacio.orientacion_manual,
        };

        const area = computeArea(espacioInput);
        const materialId = espacio.material_id;
        const material = materialId ? materialsMap.get(materialId) : undefined;

        if (!material || isContinuo(material)) {
          espaciosSinMaterial++;
          espaciosResumen.push({
            nivel_id: (nivel as any).id,
            nivel_nombre: (nivel as any).nombre,
            espacio_id: espacio.id,
            espacio_nombre: espacio.nombre,
            material_id: materialId,
            material_nombre: material?.nombre,
            area: Number(area.toFixed(4)),
            costo_estimado: 0,
            piezas: 0,
          });
          continue;
        }

        const patronId = dto.patron_id ?? espacio.patron_id ?? 'recta';
        const ajuste = dto.ajuste_desperdicio ?? espacio.ajuste_desperdicio ?? 0;
        const calc = calcularInstalacion(espacioInput, material, patronId, ajuste);

        areaTotalNecesaria += calc.areaNecesaria;
        areaTotalComprada += calc.areaComprada;
        costoTotal += calc.costoEstimado;
        piezasTotales += calc.piezas;
        espaciosCalculados++;

        espaciosResumen.push({
          nivel_id: (nivel as any).id,
          nivel_nombre: (nivel as any).nombre,
          espacio_id: espacio.id,
          espacio_nombre: espacio.nombre,
          material_id: material.id,
          material_nombre: material.nombre,
          area: Number(area.toFixed(4)),
          costo_estimado: Number(calc.costoEstimado.toFixed(2)),
          piezas: calc.piezas,
        });
      }
    }

    return {
      proyecto_id: project.id,
      nombre: project.nombre,
      resumen: {
        area_total_necesaria: Number(areaTotalNecesaria.toFixed(4)),
        area_total_comprada: Number(areaTotalComprada.toFixed(4)),
        costo_total_estimado: Number(costoTotal.toFixed(2)),
        piezas_totales: piezasTotales,
        espacios_calculados: espaciosCalculados,
        espacios_sin_material: espaciosSinMaterial,
      },
      espacios: espaciosResumen,
    };
  }
}
