import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-model local del tenant (slug -> id). Se sincroniza desde Auth.
@Entity('shops')
export class Shop {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() slug: string;
  @Column({ nullable: true }) name: string;
}
