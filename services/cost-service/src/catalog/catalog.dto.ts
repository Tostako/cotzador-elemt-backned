import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
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
import { OrigenApu } from '../entities/apu.entity';

export class CreateChapterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  codigo?: string;

  @IsInt()
  @IsOptional()
  orden?: number;
}

export class UpdateChapterDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  codigo?: string;

  @IsInt()
  @IsOptional()
  orden?: number;
}

export class ComponenteDto {
  @IsUUID()
  insumo_id: string;

  @IsNumber()
  @Min(0)
  rendimiento: number;
}

export class CreateApuDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  codigo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unidad: string;

  @IsUUID()
  @IsOptional()
  chapter_id?: string;

  @IsEnum(OrigenApu)
  @IsOptional()
  origen?: OrigenApu;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponenteDto)
  @IsOptional()
  componentes?: ComponenteDto[];
}

export class UpdateApuDto {
  @IsString()
  @IsOptional()
  @MaxLength(30)
  codigo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  descripcion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  unidad?: string;

  @IsUUID()
  @IsOptional()
  chapter_id?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponenteDto)
  @IsOptional()
  componentes?: ComponenteDto[];
}