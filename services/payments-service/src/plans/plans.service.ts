import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentPlan } from '../entities/payment-plan.entity';
import { PaymentPlanDto } from './plans.dto';

interface Ctx { shop_id: string; customer_id: string; }

@Injectable()
export class PlansService {
  constructor(@InjectRepository(PaymentPlan) private readonly plans: Repository<PaymentPlan>) {}

  findAll(ctx: Ctx) {
    return this.plans.find({ where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id }, order: { created_at: 'DESC' } });
  }

  async findOne(ctx: Ctx, id: string) {
    const p = await this.plans.findOne({ where: { id, shop_id: ctx.shop_id, customer_id: ctx.customer_id } });
    if (!p) throw new NotFoundException('Plan de pago no encontrado');
    return p;
  }

  create(ctx: Ctx, dto: PaymentPlanDto) {
    const plan = this.plans.create({
      shop_id: ctx.shop_id, customer_id: ctx.customer_id,
      name: dto.name, description: dto.description,
      installments: dto.installments, is_default: dto.isDefault ?? false,
    });
    return this.plans.save(plan);
  }

  async update(ctx: Ctx, id: string, dto: PaymentPlanDto) {
    await this.findOne(ctx, id);
    await this.plans.update({ id }, {
      name: dto.name, description: dto.description,
      installments: dto.installments, is_default: dto.isDefault ?? false,
    });
    return this.findOne(ctx, id);
  }

  async remove(ctx: Ctx, id: string) {
    await this.findOne(ctx, id);
    await this.plans.delete({ id });
    return { ok: true };
  }

  async setDefault(ctx: Ctx, id: string) {
    await this.findOne(ctx, id);
    await this.plans.update({ shop_id: ctx.shop_id, customer_id: ctx.customer_id }, { is_default: false });
    await this.plans.update({ id }, { is_default: true });
    return this.findOne(ctx, id);
  }
}
