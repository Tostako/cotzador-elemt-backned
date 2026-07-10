import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PuntoDto {
  @IsOptional() @IsNumber() x?: number;
  @IsOptional() @IsNumber() y?: number;
}

export class NodoDto extends PuntoDto {
  @IsString() @MaxLength(50) id: string;
}

export class MuroDto {
  @IsString() @MaxLength(50) a: string;
  @IsString() @MaxLength(50) b: string;
  @IsOptional() @IsBoolean() abertura?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() columnas?: number;
}

export class SegmentoDto {
  @IsNumber() largo: number;
  @IsNumber() ancho: number;
}

export class EspacioDto {
  @IsString() @MaxLength(120) id: string;
  @IsString() @MaxLength(120) nombre: string;
  @IsString() @MaxLength(60) tipo: string;

  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => NodoDto) nodos?: NodoDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => MuroDto) muros?: MuroDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PuntoDto) puntos?: PuntoDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => SegmentoDto) segmentos?: SegmentoDto[];
  @IsOptional() x?: number;
  @IsOptional() y?: number;

  @IsOptional() @IsNumber() area?: number;
  @IsOptional() @IsNumber() perimetro?: number;
  @IsOptional() @IsNumber() perimetro_muro?: number;
}

export class ConexionDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(50) a: string;
  @IsString() @MaxLength(50) b: string;
}

export class NivelDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => EspacioDto) espacios?: EspacioDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => ConexionDto) conexiones?: ConexionDto[];
}

export class CreateHousePlanDto {
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(120) propietario?: string;
  @IsOptional() @IsString() @MaxLength(200) ubicacion?: string;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => NivelDto) niveles: NivelDto[];
}

export class UpdateHousePlanDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(120) propietario?: string;
  @IsOptional() @IsString() @MaxLength(200) ubicacion?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => NivelDto) niveles?: NivelDto[];
}

export class ImportProjectDto {
  @IsString() @MaxLength(120) nombre: string;
}
