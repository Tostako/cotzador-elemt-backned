import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TipoDocumento } from '../entities/document.entity';

export class GenerarDocumentoDto {
  @IsEnum(['COTIZACION', 'FACTURA_PROFORMA', 'ORDEN_COMPRA'])
  tipo: TipoDocumento;

  @IsString()
  @IsOptional()
  referencia?: string;
}