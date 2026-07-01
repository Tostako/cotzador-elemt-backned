import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('site_configs')
export class SiteConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shop_id' }) shop_id: string;
  @Column() section: string;
  @Column() key: string;
  @Column({ type: 'text' }) value: string;
  @Column({ name: 'value_type', default: 'text' }) value_type: string;
  @Column({ default: true }) active: boolean;
}
