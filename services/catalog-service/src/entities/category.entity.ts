import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('quote_catalog_categories')
export class Category {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ name: 'main_category_id', type: 'uuid', nullable: true }) main_category_id: string | null;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ name: 'is_active', default: true }) is_active: boolean;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
