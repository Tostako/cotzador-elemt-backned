import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PlantillaDocumento {
  CLASICA = 'CLASICA',
  COMPACTA = 'COMPACTA',
  EDITORIAL = 'EDITORIAL',
}

/** Paleta validada por contraste (decisión H-01/H-02): solo estos acentos. */
export const PALETA_ACENTO_VALIDA = [
  '#0EA5E9', // Sky
  '#2563EB', // Blue
  '#16A34A', // Green
  '#059669', // Emerald
  '#F59E0B', // Amber
  '#EA580C', // Orange
  '#DC2626', // Red
  '#E11D48', // Rose
  '#7C3AED', // Violet
  '#0891B2', // Cyan
] as const;

@Entity('org_branding')
export class OrgBranding {
  @PrimaryColumn({ name: 'shop_id', type: 'uuid' })
  shop_id: string;

  @Column({ name: 'razon_social', length: 160, nullable: true })
  razon_social: string | null;

  @Column({ name: 'nombre_comercial', length: 160, nullable: true })
  nombre_comercial: string | null;

  @Column({ name: 'nit', length: 30, nullable: true })
  nit: string | null;

  @Column({ name: 'ciudad', length: 80, nullable: true })
  ciudad: string | null;

  @Column({ name: 'correo_soporte', length: 160, nullable: true })
  correo_soporte: string | null;

  @Column({ name: 'sitio_web', length: 200, nullable: true })
  sitio_web: string | null;

  @Column({ name: 'logo_url', length: 300, nullable: true })
  logo_url: string | null;

  @Column({ name: 'color_acento', length: 7, default: '#0EA5E9' })
  color_acento: string;

  @Column({ name: 'plantilla_documento', length: 20, default: 'CLASICA' })
  plantilla_documento: PlantillaDocumento;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}