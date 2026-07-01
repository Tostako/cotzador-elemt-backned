import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('landing_images')
export class LandingImage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column() type: string;
  @Column({ type: 'text' }) url: string;
  @Column({ nullable: true }) alt: string;
  @Column({ name: 'order', default: 0 }) order: number;
  @Column({ default: true }) active: boolean;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown>;
}
