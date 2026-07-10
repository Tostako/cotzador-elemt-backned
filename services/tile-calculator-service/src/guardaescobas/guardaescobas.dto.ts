import { ArrayMaxSize, IsArray, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GuardaescobasMaterialDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(120) nombre: string;
  @IsString() @MaxLength(60) tipo: string;
  @IsNumber() precio_por_metro: number;
  @IsOptional() altura?: number;
  @IsOptional() @MaxLength(60) color?: string;
}

export class CreateGuardaescobasProjectDto {
  @IsString() @MaxLength(120) nombre: string;
}

export class UpdateGuardaescobasProjectDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsNumber() saliente_columna_cm?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => GuardaescobasMaterialDto) materiales?: GuardaescobasMaterialDto[];
  @IsOptional() @IsObject() resultados?: Record<string, unknown>;
}
