import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface Installment { name: string; percentage: number; order: number; }

@Entity('payment_plans')
export class PaymentPlan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ type: 'jsonb' }) installments: Installment[];
  @Column({ name: 'is_default', default: false }) is_default: boolean;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
