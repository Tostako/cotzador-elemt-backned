import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('quote_catalog_product_prices')
export class Price {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ name: 'product_id' }) product_id: string;
  @Column({ name: 'hardware_store' }) hardware_store: string;
  @Column({ nullable: true }) brand: string;
  @Column({ type: 'numeric' }) price: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ name: 'is_active', default: true }) is_active: boolean;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
