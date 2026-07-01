import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerConfig } from '../entities/customer-config.entity';
import { UpdateConfigDto } from './config.dto';

interface Ctx { shop_id: string; customer_id: string; }

@Injectable()
export class ConfigService {
  constructor(@InjectRepository(CustomerConfig) private readonly configs: Repository<CustomerConfig>) {}

  /** Devuelve la config del customer; la crea vacía si no existe. */
  async getMine(ctx: Ctx): Promise<CustomerConfig> {
    let cfg = await this.configs.findOne({ where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id } });
    if (!cfg) {
      cfg = this.configs.create({ shop_id: ctx.shop_id, customer_id: ctx.customer_id });
      cfg = await this.configs.save(cfg);
    }
    return cfg;
  }

  /** Upsert con merge parcial: solo sobrescribe las claves enviadas. */
  async updateMine(ctx: Ctx, dto: UpdateConfigDto): Promise<CustomerConfig> {
    const cfg = await this.getMine(ctx);
    Object.assign(cfg, dto);
    return this.configs.save(cfg);
  }
}
