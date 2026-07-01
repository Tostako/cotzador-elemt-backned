import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from '../entities/quote.entity';
import { CreateQuoteDto, UpdateQuoteDto } from './quotes.dto';
import { UpdatePaymentStatusDto } from './quotes-internal.dto';

interface Ctx { shop_id: string; customer_id: string; }

@Injectable()
export class QuotesService {
  constructor(@InjectRepository(Quote) private readonly quotes: Repository<Quote>) {}

  findAll(ctx: Ctx) {
    return this.quotes.find({
      where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(ctx: Ctx, id: string) {
    const q = await this.quotes.findOne({
      where: { id, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    return q;
  }

  create(ctx: Ctx, dto: CreateQuoteDto) {
    const quote = this.quotes.create({ ...dto, shop_id: ctx.shop_id, customer_id: ctx.customer_id });
    return this.quotes.save(quote);
  }

  async update(ctx: Ctx, id: string, dto: UpdateQuoteDto) {
    await this.findOne(ctx, id);
    await this.quotes.update({ id }, dto);
    return this.findOne(ctx, id);
  }

  async remove(ctx: Ctx, id: string) {
    await this.findOne(ctx, id);
    await this.quotes.delete({ id });
    return { ok: true };
  }

  async selectPlan(ctx: Ctx, id: string, planId: string) {
    await this.findOne(ctx, id);
    await this.quotes.update({ id }, { payment_plan_id: planId });
    return this.findOne(ctx, id);
  }

  async updatePaymentStatus(id: string, dto: UpdatePaymentStatusDto) {
    const quote = await this.quotes.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    const data = { ...(quote.data ?? {}), paid_amount: dto.paid_amount };
    await this.quotes.update({ id }, { status: dto.status, data });
    return this.quotes.findOne({ where: { id } });
  }

  async findOneInternal(id: string) {
    const quote = await this.quotes.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    return quote;
  }
}
