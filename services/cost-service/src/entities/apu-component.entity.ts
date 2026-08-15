import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('apu_components')
@Index(['apu_id'])
@Index(['apu_id', 'insumo_id'])
export class ApuComponent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'apu_id', type: 'uuid' })
  apu_id: string;

  @Column({ name: 'insumo_id', type: 'uuid' })
  insumo_id: string;

  @Column({ name: 'rendimiento', type: 'numeric' })
  rendimiento: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}