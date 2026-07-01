import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('quote_catalog_order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ name: 'order_id' }) order_id: string;
  @Column({ name: 'product_id' }) product_id: string;
  @Column({ name: 'price_id' }) price_id: string;
  @Column({ name: 'main_product_id', type: 'uuid', nullable: true }) main_product_id: string | null;
  @Column({ type: 'int' }) quantity: number;
  @Column({ name: 'unit_price', type: 'numeric' }) unit_price: number;
  @Column({ type: 'numeric' }) subtotal: number;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
}
