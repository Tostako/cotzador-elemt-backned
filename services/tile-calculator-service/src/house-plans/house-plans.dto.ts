import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PuntoDto {
  @IsOptional() @IsNumber() x?: number;
  @IsOptional() @IsNumber() y?: number;
}

export class NodoDto extends PuntoDto {
  @IsString() id: string;
}

export class MuroDto {
  @IsString() a: string;
  @IsString() b: string;
  @IsOptional() @IsBoolean() abertura?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() columnas?: number;
}

export class SegmentoDto {
  @IsNumber() largo: number;
  @IsNumber() ancho: number;
}

export class EspacioDto {
  @IsString() id: string;
  @IsString() nombre: string;
  @IsString() tipo: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NodoDto) nodos?: NodoDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MuroDto) muros?: MuroDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PuntoDto) puntos?: PuntoDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SegmentoDto) segmentos?: SegmentoDto[];
  @IsOptional() x?: number;
  @IsOptional() y?: number;

  @IsOptional() @IsNumber() area?: number;
  @IsOptional() @IsNumber() perimetro?: number;
  @IsOptional() @IsNumber() perimetro_muro?: number;
}

export class ConexionDto {
  @IsString() id: string;
  @IsString() a: string;
  @IsString() b: string;
}

export class NivelDto {
  @IsString() id: string;
  @IsString() nombre: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EspacioDto) espacios?: EspacioDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ConexionDto) conexiones?: ConexionDto[];
}

export class CreateHousePlanDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() propietario?: string;
  @IsOptional() @IsString() ubicacion?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => NivelDto) niveles: NivelDto[];
}

export class UpdateHousePlanDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() propietario?: string;
  @IsOptional() @IsString() ubicacion?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NivelDto) niveles?: NivelDto[];
}

export class ImportProjectDto {
  @IsString() nombre: string;
}
