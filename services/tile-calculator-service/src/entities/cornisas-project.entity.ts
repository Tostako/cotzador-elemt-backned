import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Nivel } from '../common/house-plan.interfaces';

export interface CornisasMaterial {
  id: string;
  nombre: string;
  tipo: string;
  color?: string;
  altura?: number;
  modo: 'metro' | 'tira';
  precio_por_metro: number;
  largo_cm: number;
  precio_por_tira: number;
}

export interface CornisasResultado {
  total_metros: number;
  total_precio: number;
  detalle: {
    espacio_id: string;
    nombre: string;
    perimetro: number;
    material_id: string;
    modo: 'metro' | 'tira';
    tiras: number;
    precio: number;
  }[];
}

@Entity('cornisas_projects')
export class CornisasProject {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column({ name: 'customer_id' }) customer_id: string;
  @Column({ name: 'house_plan_id', type: 'uuid', nullable: true }) house_plan_id: string | null;
  @Column() nombre: string;
  @Column({ type: 'jsonb', default: [] }) niveles: Nivel[];
  @Column({ type: 'jsonb', default: [] }) materiales: CornisasMaterial[];
  @Column({ type: 'jsonb', default: {} }) resultados: CornisasResultado | Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
