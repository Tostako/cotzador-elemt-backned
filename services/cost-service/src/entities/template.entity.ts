import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface TemplateActividad {
  apu_id: string;
  cantidad: number;
}

@Entity('templates')
@Index(['shop_id'])
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shop_id: string;

  @Column({ name: 'codigo', length: 30 })
  codigo: string;

  @Column({ name: 'nombre', length: 120 })
  nombre: string;

  @Column({ name: 'alcance', length: 500, nullable: true })
  alcance: string | null;

  @Column({ name: 'area_referencia', type: 'numeric', default: 0 })
  area_referencia: string;

  @Column({ name: 'actividades', type: 'jsonb', default: () => "'[]'" })
  actividades: TemplateActividad[];

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
