import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('quote_catalog_products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ name: 'category_id' }) category_id: string;
  @Column({ name: 'main_product_id', type: 'uuid', nullable: true }) main_product_id: string | null;
  @Column({ nullable: true }) sku: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ name: 'is_active', default: true }) is_active: boolean;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
