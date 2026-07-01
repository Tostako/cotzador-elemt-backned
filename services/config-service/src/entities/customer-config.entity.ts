import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('customer_configs')
export class CustomerConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ type: 'jsonb', default: {} }) services: Record<string, unknown>;
  @Column({ name: 'sub_packages', type: 'jsonb', default: {} }) sub_packages: Record<string, unknown>;
  @Column({ name: 'complete_package', type: 'jsonb', default: {} }) complete_package: Record<string, unknown>;
  @Column({ name: 'payment_plan', type: 'jsonb', default: {} }) payment_plan: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) invoice: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) estimation: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
