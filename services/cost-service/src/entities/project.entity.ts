import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TipoObra {
  OBRA_NUEVA = 'OBRA_NUEVA',
  REMODELACION = 'REMODELACION',
  ADECUACION = 'ADECUACION',
  MANTENIMIENTO = 'MANTENIMIENTO',
}

export enum EstadoProyecto {
  BORRADOR = 'BORRADOR',
  EN_REVISION = 'EN_REVISION',
  APROBADO = 'APROBADO',
  ARCHIVADO = 'ARCHIVADO',
  PAPELERA = 'PAPELERA',
}

export interface AiuConfig {
  pctAdministracion: number;
  pctImprevistos: number;
  pctUtilidad: number;
  ivaAplica: boolean;
  pctIva: number;
  baseIva: 'TOTAL' | 'AIU' | 'UTILIDAD';
  descuento: number;
}

@Entity('projects')
@Index(['shop_id', 'customer_id'])
@Index(['shop_id', 'customer_id', 'created_at'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shop_id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customer_id: string;

  @Column({ name: 'nombre', length: 120 })
  nombre: string;

  @Column({ name: 'cliente', length: 120, nullable: true })
  cliente: string | null;

  @Column({ name: 'ubicacion', length: 160, nullable: true })
  ubicacion: string | null;

  @Column({ name: 'area_m2', type: 'numeric' })
  area_m2: string;

  @Column({ name: 'tipo_obra', length: 30, nullable: true })
  tipo_obra: TipoObra | null;

  @Column({ name: 'fecha', type: 'date', nullable: true })
  fecha: string | null;

  @Column({ name: 'estado', length: 20, default: 'BORRADOR' })
  estado: EstadoProyecto;

  @Column({ name: 'aiu', type: 'jsonb', default: () => "'{}'" })
  aiu: AiuConfig;

  @Column({ name: 'version', type: 'integer', default: 1 })
  version: number;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}