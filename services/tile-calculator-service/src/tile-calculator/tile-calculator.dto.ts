import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PuntoDto {
  @IsOptional() @IsNumber() x?: number;
  @IsOptional() @IsNumber() y?: number;
}

class NodoDto extends PuntoDto {
  @IsString() @MaxLength(50) id: string;
}

class MuroDto {
  @IsString() @MaxLength(50) a: string;
  @IsString() @MaxLength(50) b: string;
  @IsOptional() @IsBoolean() abertura?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() columnas?: number;
}

class SegmentoDto {
  @IsNumber() largo: number;
  @IsNumber() ancho: number;
}

class EspacioDto {
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

  @IsOptional() @MaxLength(50) material_id?: string;
  @IsOptional() @MaxLength(50) patron_id?: string;
  @IsOptional() ajuste_desperdicio?: number;
  @IsOptional() @MaxLength(60) orientacion_manual?: string | null;
  @IsOptional() @MaxLength(60) filtro_tipo_acabado?: string | null;
}

class ConexionDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(50) a: string;
  @IsString() @MaxLength(50) b: string;
}

class NivelDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => EspacioDto) espacios?: EspacioDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => ConexionDto) conexiones?: ConexionDto[];
}

class MaterialDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(120) nombre: string;
  @IsString() @MaxLength(60) tipo_acabado: string;
  @IsOptional() formato_largo?: number;
  @IsOptional() formato_ancho?: number;
  @IsOptional() formato_grosor?: number;
  @IsOptional() @MaxLength(60) color?: string;
  @IsOptional() @MaxLength(120) marca?: string;
  @IsString() @MaxLength(60) categoria: string;
  @IsOptional() m2_caja?: number;
  @IsOptional() peso_caja?: number;
  @IsString() @MaxLength(60) modo_precio: string;
  @IsOptional() precio_m2?: number | null;
  @IsOptional() precio_caja?: number | null;
  @IsOptional() umbral_sobrante_cm?: number;
}

class SobranteDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(50) material_id: string;
  @IsNumber() ancho: number;
  @IsNumber() alto: number;
  @IsNumber() cantidad: number;
  @IsString() @MaxLength(50) origen_nivel_id: string;
  @IsString() @MaxLength(50) origen_space_id: string;
  @IsString() @MaxLength(50) patron_id: string;
  @IsString() @MaxLength(60) direccion: string;
  @IsOptional() @IsNumber() total_cortes?: number;
  @IsNumber() tramo_index: number;
  @IsString() @MaxLength(60) origen: string;
  @IsString() @MaxLength(60) fecha: string;
}

export class CreateProjectDto {
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(120) propietario?: string;
  @IsOptional() @IsString() @MaxLength(200) ubicacion?: string;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(120) propietario?: string;
  @IsOptional() @IsString() @MaxLength(200) ubicacion?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => NivelDto) niveles?: NivelDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => MaterialDto) materiales?: MaterialDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => SobranteDto) banco_sobrantes?: SobranteDto[];
}
