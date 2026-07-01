import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ name: 'quote_id' }) quote_id: string;
  @Column({ name: 'installment_index', type: 'int' }) installment_index: number;
  @Column({ type: 'numeric' }) amount: number;
  @Column() method: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ default: 'confirmed' }) status: string;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paid_at: Date;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
