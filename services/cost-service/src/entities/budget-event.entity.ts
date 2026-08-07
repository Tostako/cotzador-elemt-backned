import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface BudgetEventState {
  items: Array<{
    id: string;
    chapter_id: string | null;
    apu_id: string | null;
    descripcion: string;
    unidad: string;
    cantidad: string;
    valor_unitario: string;
    deleted_at: string | null;
  }>;
  version: number;
}

@Entity('budget_events')
@Index(['project_id'])
@Index('idx_budget_events_undo', ['undo_token'], { unique: true, where: 'undone_at IS NULL' })
export class BudgetEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  project_id: string;

  @Column({ name: 'tipo', length: 40 })
  tipo: string;

  @Column({ name: 'undo_token', type: 'uuid', nullable: true })
  undo_token: string | null;

  @Column({ name: 'estado_antes', type: 'jsonb' })
  estado_antes: BudgetEventState;

  @Column({ name: 'estado_despues', type: 'jsonb' })
  estado_despues: BudgetEventState;

  @Column({ name: 'usuario', length: 120, nullable: true })
  usuario: string | null;

  @Column({ name: 'undone_at', type: 'timestamptz', nullable: true })
  undone_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}