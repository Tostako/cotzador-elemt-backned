import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PlantillaDocumento } from '../entities/org-branding.entity';

export class ActualizarMarcaDto {
  @IsString()
  @IsOptional()
  @MaxLength(160)
  razon_social?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  nombre_comercial?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  nit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  ciudad?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(160)
  correo_soporte?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  sitio_web?: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color_acento debe ser un color hexadecimal #RRGGBB de la paleta validada',
  })
  @IsOptional()
  color_acento?: string;

  @IsEnum(PlantillaDocumento)
  @IsOptional()
  plantilla_documento?: PlantillaDocumento;
}