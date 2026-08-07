import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum GrupoInsumo {
  MATERIAL = 'MATERIAL',
  MANO_OBRA = 'MANO_OBRA',
  EQUIPO = 'EQUIPO',
  TRANSPORTE = 'TRANSPORTE',
}

@Entity('supplies')
@Index(['shop_id', 'grupo'])
export class Supply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shop_id: string;

  @Column({ name: 'descripcion', length: 200 })
  descripcion: string;

  @Column({ name: 'unidad', length: 20 })
  unidad: string;

  @Column({ name: 'grupo', length: 20 })
  grupo: GrupoInsumo;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}