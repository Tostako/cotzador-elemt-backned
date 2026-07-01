import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column() name: string;
  @Column() email: string;
  @Column({ nullable: true }) phone: string;
  @Column({ type: 'text', nullable: true }) address: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ select: false, nullable: true }) password: string;
  @Column({ name: 'last_login', type: 'timestamptz', nullable: true }) last_login: Date;
  @Column({ name: 'is_active', default: true }) is_active: boolean;
  @Column({ name: 'can_manage_quote_catalog', default: false }) can_manage_quote_catalog: boolean;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
