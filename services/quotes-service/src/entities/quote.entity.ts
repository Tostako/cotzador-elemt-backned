import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column() client: string;
  @Column() project: string;
  @Column({ type: 'numeric' }) area: number;
  @Column({ type: 'numeric' }) price: number;
  @Column({ default: 'draft' }) status: string; // draft | sent | paid | completed | partially_paid
  @Column({ type: 'jsonb', default: {} }) data: Record<string, unknown>;
  @Column({ type: 'date', default: () => 'CURRENT_DATE' }) date: string;
  @Column({ name: 'payment_plan_id', type: 'uuid', nullable: true }) payment_plan_id: string | null;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
