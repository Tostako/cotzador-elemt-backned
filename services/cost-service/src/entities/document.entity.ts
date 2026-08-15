import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TipoDocumento =
  | 'COTIZACION'
  | 'FACTURA_PROFORMA'
  | 'ORDEN_COMPRA'
  | 'PDF_CLIENTE'
  | 'PDF_INTERNO'
  | 'PDF_COSTOS_APU'
  | 'XLSX_PRESUPUESTO'
  | 'XLSX_INSUMOS'
  | 'XLSX_APUS';
export type EstadoDocumento = 'GENERANDO' | 'LISTO' | 'ERROR' | 'OBSOLETO';

@Entity('documents')
@Index(['project_id'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  project_id: string;

  @Column({ name: 'tipo', length: 30 })
  tipo: TipoDocumento;

  @Column({ name: 'estado', length: 20, default: 'GENERANDO' })
  estado: EstadoDocumento;

  @Column({ name: 'referencia', length: 80, nullable: true })
  referencia: string | null;

  @Column({ name: 'total_congelado', type: 'numeric', nullable: true })
  total_congelado: string | null;

  @Column({ name: 'file_path', length: 250, nullable: true })
  file_path: string | null;

  @Column({ name: 'error', length: 400, nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}