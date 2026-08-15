import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { GrupoInsumo } from '../entities/supply.entity';
import { OrigenPrecio } from '../entities/supply-price.entity';

export class CreateSupplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unidad: string;

  @IsEnum(GrupoInsumo)
  grupo: GrupoInsumo;
}

export class UpdateSupplyDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  descripcion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  unidad?: string;

  @IsEnum(GrupoInsumo)
  @IsOptional()
  grupo?: GrupoInsumo;
}

export class CreatePriceDto {
  @IsNumber()
  @Min(0)
  valor: number;

  @IsDateString()
  @IsOptional()
  vigente_desde?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  usuario?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  motivo?: string;

  @IsEnum(OrigenPrecio)
  @IsOptional()
  origen?: OrigenPrecio;
}

export class ListPricesDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class RecargaMasivaDto {
  @IsUUID()
  @IsOptional()
  shop_id?: string;

  @IsEnum(GrupoInsumo)
  @IsOptional()
  grupo?: GrupoInsumo;
}