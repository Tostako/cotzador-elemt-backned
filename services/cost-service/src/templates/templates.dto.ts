import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AplicarPlantillaDto {
  @IsString()
  templateId: string;

  @IsIn(['REEMPLAZAR', 'AGREGAR'])
  @IsOptional()
  modo?: 'REEMPLAZAR' | 'AGREGAR';
}

export class TemplateActividadDto {
  @IsUUID()
  apu_id: string;

  @IsNumber()
  @Min(0.0001)
  cantidad: number;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  codigo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  alcance?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  area_referencia?: number;

  @IsUUID()
  @IsOptional()
  project_id?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateActividadDto)
  @IsOptional()
  actividades?: TemplateActividadDto[];
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(30)
  codigo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  alcance?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  area_referencia?: number;

  @IsUUID()
  @IsOptional()
  project_id?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateActividadDto)
  @IsOptional()
  actividades?: TemplateActividadDto[];
}
