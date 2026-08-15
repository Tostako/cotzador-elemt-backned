import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('quotations')
@Index(['shop_id'])
@Index(['project_id'])
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shop_id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  project_id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customer_id: string;

  @Column({ name: 'creada_en', type: 'timestamptz' })
  creada_en: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}