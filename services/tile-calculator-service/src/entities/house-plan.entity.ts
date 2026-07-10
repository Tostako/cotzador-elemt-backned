import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Nivel } from '../common/house-plan.interfaces';

@Entity('house_plans')
export class HousePlan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column() nombre: string;
  @Column({ nullable: true }) propietario: string | null;
  @Column({ nullable: true }) ubicacion: string | null;
  @Column({ type: 'jsonb', default: [] }) niveles: Nivel[];
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
