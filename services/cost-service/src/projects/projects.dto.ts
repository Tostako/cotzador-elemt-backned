import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoProyecto, TipoObra } from '../entities/project.entity';

export class AiuConfigDto {
  @IsNumber()
  pctAdministracion: number;

  @IsNumber()
  pctImprevistos: number;

  @IsNumber()
  pctUtilidad: number;

  @IsBoolean()
  @IsOptional()
  ivaAplica?: boolean;

  @IsNumber()
  @IsOptional()
  pctIva?: number;

  @IsEnum(['TOTAL', 'AIU', 'UTILIDAD'])
  @IsOptional()
  baseIva?: 'TOTAL' | 'AIU' | 'UTILIDAD';

  @IsNumber()
  @IsOptional()
  descuento?: number;
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  cliente?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  ubicacion?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  area_m2?: number;

  @IsEnum(TipoObra)
  @IsOptional()
  tipo_obra?: TipoObra;

  @IsDateString()
  @IsOptional()
  fecha?: string;

  @ValidateNested()
  @Type(() => AiuConfigDto)
  @IsOptional()
  aiu?: AiuConfigDto;
}

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  cliente?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  ubicacion?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  area_m2?: number;

  @IsEnum(TipoObra)
  @IsOptional()
  tipo_obra?: TipoObra;

  @IsDateString()
  @IsOptional()
  fecha?: string;

  @IsEnum(EstadoProyecto)
  @IsOptional()
  estado?: EstadoProyecto;

  @ValidateNested()
  @Type(() => AiuConfigDto)
  @IsOptional()
  aiu?: AiuConfigDto;
}

export class ListProjectsQueryDto {
  @IsEnum(EstadoProyecto)
  @IsOptional()
  estado?: EstadoProyecto;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  per_page?: number;
}