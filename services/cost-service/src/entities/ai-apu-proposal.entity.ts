import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EstadoPropuestaApu {
  EN_ESPERA = 'EN_ESPERA',
  ACEPTADA = 'ACEPTADA',
  RECHAZADA = 'RECHAZADA',
}

export interface ComponentePropuesta {
  insumo_id: string | null;
  existe: boolean;
  rendimiento: number;
  precio: string;
  nuevo: {
    descripcion: string;
    unidad: string;
    precio_sugerido: string;
  } | null;
}

@Entity('ai_apu_proposals')
@Index(['shop_id'])
@Index(['estado'])
export class AiApuProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shop_id: string;

  @Column({ name: 'solicitud', length: 500 })
  solicitud: string;

  @Column({ name: 'capitulo_sugerido', length: 160, nullable: true })
  capitulo_sugerido: string | null;

  @Column({ name: 'descripcion', length: 200 })
  descripcion: string;

  @Column({ name: 'unidad', length: 20 })
  unidad: string;

  @Column({ name: 'costo_calculado', type: 'numeric' })
  costo_calculado: string;

  @Column({ name: 'componentes', type: 'jsonb' })
  componentes: ComponentePropuesta[];

  @Column({ name: 'cuota_restante', type: 'integer', default: 20 })
  cuota_restante: number;

  @Column({ name: 'estado', length: 20, default: 'EN_ESPERA' })
  estado: EstadoPropuestaApu;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  accepted_at: Date | null;
}