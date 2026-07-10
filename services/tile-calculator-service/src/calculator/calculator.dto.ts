import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SegmentoCalcDto {
  @IsNumber() largo: number;
  @IsNumber() ancho: number;
}

class EspacioCalcDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => SegmentoCalcDto) segmentos: SegmentoCalcDto[];
  @IsOptional() @IsString() tipo?: 'piso' | 'pared';
  @IsOptional() @IsString() orientacion_manual?: 'largo' | 'ancho' | null;
}

class MaterialCalcDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(120) nombre: string;
  @IsString() @MaxLength(60) tipo_acabado: string;
  @IsOptional() @IsNumber() formato_largo?: number;
  @IsOptional() @IsNumber() formato_ancho?: number;
  @IsString() @MaxLength(60) modo_precio: 'm2' | 'caja';
  @IsOptional() @IsNumber() precio_m2?: number | null;
  @IsOptional() @IsNumber() precio_caja?: number | null;
  @IsOptional() @IsNumber() m2_caja?: number | null;
}

export class CalculateSpaceDto {
  @ValidateNested() @Type(() => EspacioCalcDto) espacio: EspacioCalcDto;
  @ValidateNested() @Type(() => MaterialCalcDto) material: MaterialCalcDto;
  @IsString() @MaxLength(50) patron_id: string;
  @IsOptional() @IsNumber() ajuste_desperdicio?: number;
}

export class CalculateOffcutsDto {
  @ValidateNested() @Type(() => EspacioCalcDto) espacio: EspacioCalcDto;
  @ValidateNested() @Type(() => MaterialCalcDto) material: MaterialCalcDto;
  @IsOptional() @IsBoolean() usar_lado_mayor?: boolean;
}

export class CalculateProjectDto {
  @IsOptional() @IsString() @MaxLength(50) patron_id?: string;
  @IsOptional() @IsNumber() ajuste_desperdicio?: number;
}
