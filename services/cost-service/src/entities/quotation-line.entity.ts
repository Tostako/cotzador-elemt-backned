import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EstadoLineaCotizacion {
  PENDIENTE = 'PENDIENTE',
  COTIZADO = 'COTIZADO',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

@Entity('quotation_lines')
@Index(['quotation_id'])
export class QuotationLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quotation_id', type: 'uuid' })
  quotation_id: string;

  @Column({ name: 'insumo_id', type: 'uuid' })
  insumo_id: string;

  @Column({ name: 'descripcion', length: 200 })
  descripcion: string;

  @Column({ name: 'unidad', length: 20 })
  unidad: string;

  @Column({ name: 'cantidad_total', type: 'numeric' })
  cantidad_total: string;

  @Column({ name: 'precio_presupuestado', type: 'numeric' })
  precio_presupuestado: string;

  @Column({ name: 'proveedor', length: 160, nullable: true })
  proveedor: string | null;

  @Column({ name: 'precio_cotizado', type: 'numeric', nullable: true })
  precio_cotizado: string | null;

  @Column({ name: 'estado', length: 20, default: 'PENDIENTE' })
  estado: EstadoLineaCotizacion;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}