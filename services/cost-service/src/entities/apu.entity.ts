import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OrigenApu {
  BASE = 'BASE',
  PERSONALIZADO = 'PERSONALIZADO',
  GENERADO_IA = 'GENERADO_IA',
  IMPORTADO = 'IMPORTADO',
}

@Entity('apus')
@Index(['shop_id'])
@Index(['shop_id', 'chapter_id'])
@Index(['shop_id', 'codigo'])
export class Apu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shop_id: string;

  @Column({ name: 'chapter_id', type: 'uuid', nullable: true })
  chapter_id: string | null;

  @Column({ name: 'codigo', length: 30 })
  codigo: string;

  @Column({ name: 'descripcion', length: 200 })
  descripcion: string;

  @Column({ name: 'unidad', length: 20 })
  unidad: string;

  @Column({ name: 'origen', length: 20, default: 'PERSONALIZADO' })
  origen: OrigenApu;

  @Column({ name: 'version', type: 'integer', default: 1 })
  version: number;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}