import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Nivel } from '../common/house-plan.interfaces';

export interface GuardaescobasMaterial {
  id: string;
  nombre: string;
  tipo: string;
  precio_por_metro: number;
  altura?: number;
  color?: string;
}

export interface GuardaescobasResultado {
  total_metros: number;
  total_precio: number;
  detalle: {
    espacio_id: string;
    nombre: string;
    perimetro: number;
    material_id: string;
    precio: number;
  }[];
}

@Entity('guardaescobas_projects')
export class GuardaescobasProject {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ name: 'house_plan_id', type: 'uuid', nullable: true }) house_plan_id: string | null;
  @Column() nombre: string;
  @Column({ type: 'jsonb', default: [] }) niveles: Nivel[];
  @Column({ type: 'jsonb', default: [] }) materiales: GuardaescobasMaterial[];
  @Column({ name: 'saliente_columna_cm', type: 'numeric', nullable: true }) saliente_columna_cm: number | null;
  @Column({ name: 'resultados', type: 'jsonb', default: {} }) resultados: GuardaescobasResultado | Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
