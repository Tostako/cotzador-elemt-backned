import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum OrigenPrecio {
  MANUAL = 'MANUAL',
  IMPORTACION = 'IMPORTACION',
  COTIZACION = 'COTIZACION',
}

@Entity('supply_prices')
@Index(['supply_id'])
@Index(['supply_id', 'vigente_desde'])
export class SupplyPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'supply_id', type: 'uuid' })
  supply_id: string;

  @Column({ name: 'valor', type: 'numeric' })
  valor: string;

  @Column({ name: 'vigente_desde', type: 'timestamptz' })
  vigente_desde: Date;

  @Column({ name: 'usuario', length: 120, nullable: true })
  usuario: string | null;

  @Column({ name: 'motivo', length: 300, nullable: true })
  motivo: string | null;

  @Column({ name: 'origen', length: 20, default: 'MANUAL' })
  origen: OrigenPrecio;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}