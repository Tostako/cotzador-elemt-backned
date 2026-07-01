import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('quote_catalog_orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ type: 'numeric', default: 0 }) subtotal: number;
  @Column({ type: 'numeric', default: 0 }) total: number;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
