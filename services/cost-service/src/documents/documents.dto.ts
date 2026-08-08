import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TipoDocumento } from '../entities/document.entity';

export class GenerarDocumentoDto {
  @IsEnum([
    'COTIZACION',
    'FACTURA_PROFORMA',
    'ORDEN_COMPRA',
    'PDF_CLIENTE',
    'PDF_INTERNO',
    'PDF_COSTOS_APU',
    'XLSX_PRESUPUESTO',
    'XLSX_INSUMOS',
    'XLSX_APUS',
  ])
  tipo: TipoDocumento;

  @IsString()
  @IsOptional()
  referencia?: string;
}