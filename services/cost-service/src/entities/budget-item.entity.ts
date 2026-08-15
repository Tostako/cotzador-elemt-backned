import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface ApuSnapshot {
  apu_id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  valor_unitario: string;
  componentes: Array<{
    insumo_id: string;
    descripcion: string;
    unidad: string;
    grupo: string;
    rendimiento: string;
    valor: string;
    subtotal: string;
  }>;
  version: number;
  capturado_en: string;
}

@Entity('budget_items')
@Index(['project_id', 'chapter_id'])
@Index(['project_id', 'deleted_at'])
@Index(['project_id', 'apu_id'])
export class BudgetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  project_id: string;

  @Column({ name: 'chapter_id', type: 'uuid', nullable: true })
  chapter_id: string | null;

  @Column({ name: 'apu_id', type: 'uuid', nullable: true })
  apu_id: string | null;

  @Column({ name: 'apu_snapshot', type: 'jsonb' })
  apu_snapshot: ApuSnapshot;

  @Column({ name: 'descripcion', length: 200 })
  descripcion: string;

  @Column({ name: 'unidad', length: 20 })
  unidad: string;

  @Column({ name: 'cantidad', type: 'numeric', default: '0' })
  cantidad: string;

  @Column({ name: 'valor_unitario', type: 'numeric', default: '0' })
  valor_unitario: string;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}