import { IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GuardaescobasMaterialDto {
  @IsString() id: string;
  @IsString() nombre: string;
  @IsString() tipo: string;
  @IsNumber() precio_por_metro: number;
  @IsOptional() altura?: number;
  @IsOptional() color?: string;
}

export class CreateGuardaescobasProjectDto {
  @IsString() nombre: string;
}

export class UpdateGuardaescobasProjectDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsNumber() saliente_columna_cm?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GuardaescobasMaterialDto) materiales?: GuardaescobasMaterialDto[];
  @IsOptional() @IsObject() resultados?: Record<string, unknown>;
}
