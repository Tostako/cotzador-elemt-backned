import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SegmentoDto {
  @IsNumber() largo: number;
  @IsNumber() ancho: number;
}

class EspacioDto {
  @IsString() id: string;
  @IsString() nombre: string;
  @IsString() tipo: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SegmentoDto) segmentos: SegmentoDto[];
  @IsOptional() x?: number;
  @IsOptional() y?: number;
  @IsOptional() material_id?: string;
  @IsOptional() patron_id?: string;
  @IsOptional() ajuste_desperdicio?: number;
  @IsOptional() orientacion_manual?: string | null;
  @IsOptional() filtro_tipo_acabado?: string | null;
}

class ConexionDto {
  @IsString() id: string;
  @IsString() a: string;
  @IsString() b: string;
}

class NivelDto {
  @IsString() id: string;
  @IsString() nombre: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => EspacioDto) espacios: EspacioDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ConexionDto) conexiones: ConexionDto[];
}

class MaterialDto {
  @IsString() id: string;
  @IsString() nombre: string;
  @IsString() tipo_acabado: string;
  @IsOptional() formato_largo?: number;
  @IsOptional() formato_ancho?: number;
  @IsOptional() formato_grosor?: number;
  @IsOptional() color?: string;
  @IsOptional() marca?: string;
  @IsString() categoria: string;
  @IsOptional() m2_caja?: number;
  @IsOptional() peso_caja?: number;
  @IsString() modo_precio: string;
  @IsOptional() precio_m2?: number | null;
  @IsOptional() precio_caja?: number | null;
  @IsOptional() umbral_sobrante_cm?: number;
}

class SobranteDto {
  @IsString() id: string;
  @IsString() material_id: string;
  @IsNumber() ancho: number;
  @IsNumber() alto: number;
  @IsNumber() cantidad: number;
  @IsString() origen_nivel_id: string;
  @IsString() origen_space_id: string;
  @IsString() patron_id: string;
  @IsString() direccion: string;
  @IsOptional() @IsNumber() total_cortes?: number;
  @IsNumber() tramo_index: number;
  @IsString() origen: string;
  @IsString() fecha: string;
}

export class CreateProjectDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() propietario?: string;
  @IsOptional() @IsString() ubicacion?: string;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() propietario?: string;
  @IsOptional() @IsString() ubicacion?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NivelDto) niveles?: NivelDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MaterialDto) materiales?: MaterialDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SobranteDto) banco_sobrantes?: SobranteDto[];
}
