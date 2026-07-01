import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('shops')
export class Shop {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() slug: string;
  @Column() email: string;
  @Column({ nullable: true }) phone: string;
  @Column({ type: 'text', nullable: true }) address: string;
  @Column({ name: 'logo_url', type: 'text', nullable: true }) logo_url: string;
  @Column({ default: 'USD' }) currency: string;
  @Column({ default: 'UTC' }) timezone: string;
  @Column({ name: 'is_active', default: true }) is_active: boolean;
  @Column({ default: 'free' }) plan: string;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
