import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OrgBranding,
  PALETA_ACENTO_VALIDA,
  PlantillaDocumento,
} from '../entities/org-branding.entity';
import { ActualizarMarcaDto } from './branding.dto';

@Injectable()
export class BrandingService {
  constructor(
    @InjectRepository(OrgBranding) private readonly brandingRepo: Repository<OrgBranding>,
  ) {}

  private defaults(): Partial<OrgBranding> {
    return {
      color_acento: '#0EA5E9',
      plantilla_documento: PlantillaDocumento.CLASICA,
    };
  }

  private async getOrCreate(shopId: string): Promise<OrgBranding> {
    let branding = await this.brandingRepo.findOne({ where: { shop_id: shopId } });
    if (!branding) {
      branding = this.brandingRepo.create({ shop_id: shopId, ...this.defaults() });
      await this.brandingRepo.save(branding);
    }
    return branding;
  }

  async obtener(shopId: string) {
    const branding = await this.getOrCreate(shopId);
    return {
      razon_social: branding.razon_social,
      nombre_comercial: branding.nombre_comercial,
      nit: branding.nit,
      ciudad: branding.ciudad,
      correo_soporte: branding.correo_soporte,
      sitio_web: branding.sitio_web,
      logo_url: branding.logo_url,
      color_acento: branding.color_acento,
      plantilla_documento: branding.plantilla_documento,
      updated_at: branding.updated_at?.toISOString() ?? null,
    };
  }

  /**
   * HU-25. Descarte de los hallazgos H-01 y H-02: el color de acento debe
   * pertenecer a la paleta validada por contraste; no existen campos de
   * dimensiones ni de color de fondo.
   */
  async actualizar(shopId: string, dto: ActualizarMarcaDto) {
    if (dto.color_acento !== undefined) {
      const color = dto.color_acento.toUpperCase();
      if (!(PALETA_ACENTO_VALIDA as readonly string[]).includes(color)) {
        throw new UnprocessableEntityException({
          error: 'COLOR_NO_VALIDO',
          mensaje: `El color ${dto.color_acento} no pertenece a la paleta validada por contraste`,
          paleta: PALETA_ACENTO_VALIDA,
        });
      }
      dto.color_acento = color;
    }

    const branding = await this.getOrCreate(shopId);
    Object.assign(branding, dto);
    await this.brandingRepo.save(branding);

    return this.obtener(shopId);
  }
}