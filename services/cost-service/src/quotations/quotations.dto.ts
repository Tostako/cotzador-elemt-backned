import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { EstadoLineaCotizacion } from '../entities/quotation-line.entity';

export class RegistrarLineaCotizacionDto {
  @IsString()
  @IsOptional()
  @MaxLength(160)
  proveedor?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  precio_cotizado?: number;

  @IsEnum(EstadoLineaCotizacion)
  @IsOptional()
  estado?: EstadoLineaCotizacion;
}

export class CrearCotizacionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  grupo: string;
}