import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Payment } from '../entities/payment.entity';
import { PaymentPlan, Installment } from '../entities/payment-plan.entity';
import { CreatePaymentDto } from './payments.dto';

interface Ctx { shop_id: string; customer_id: string; }

export interface InstallmentStatus extends Installment {
  index: number;
  paid: boolean;
  paid_amount: number;
  due_amount: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentPlan) private readonly plans: Repository<PaymentPlan>,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  list(ctx: Ctx, quoteId: string) {
    return this.payments.find({
      where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id, quote_id: quoteId },
      order: { created_at: 'ASC' },
    });
  }

  async create(ctx: Ctx, quoteId: string, dto: CreatePaymentDto) {
    const payment = this.payments.create({
      shop_id: ctx.shop_id, customer_id: ctx.customer_id, quote_id: quoteId,
      installment_index: dto.installmentIndex, amount: dto.amount, method: dto.method,
      notes: dto.notes, status: dto.status ?? 'confirmed',
      paid_at: dto.paidAt ? new Date(dto.paidAt) : new Date(),
    });
    const saved = await this.payments.save(payment);

    await this.syncQuotePaymentStatus(quoteId).catch((err) => {
      console.error('[PAYMENTS] Fallo sincronizacion con quotes-service:', err.message);
    });

    return saved;
  }

  async remove(ctx: Ctx, quoteId: string, paymentId: string) {
    const p = await this.payments.findOne({
      where: { id: paymentId, shop_id: ctx.shop_id, customer_id: ctx.customer_id, quote_id: quoteId },
    });
    if (!p) throw new NotFoundException('Pago no encontrado');
    await this.payments.delete({ id: paymentId });

    await this.syncQuotePaymentStatus(quoteId).catch((err) => {
      console.error('[PAYMENTS] Fallo sincronizacion con quotes-service:', err.message);
    });

    return { ok: true };
  }

  async getInstallments(ctx: Ctx, quoteId: string) {
    const quote = await this.getQuoteInternal(quoteId);
    const totalPrice = Number(quote.price ?? 0);
    const planId = quote.payment_plan_id;
    if (!planId) return [];

    const plan = await this.plans.findOne({
      where: { id: planId, shop_id: ctx.shop_id, customer_id: ctx.customer_id },
    });
    if (!plan) return [];

    const paid = await this.payments.find({
      where: { shop_id: ctx.shop_id, customer_id: ctx.customer_id, quote_id: quoteId, status: 'confirmed' },
    });

    const byIndex = new Map<number, number>();
    for (const p of paid) {
      byIndex.set(p.installment_index, (byIndex.get(p.installment_index) ?? 0) + Number(p.amount));
    }

    return plan.installments.map((inst, index) => {
      const due = totalPrice * (inst.percentage / 100);
      const paidAmount = byIndex.get(index) ?? 0;
      return {
        ...inst,
        index,
        paid: paidAmount >= due,
        paid_amount: paidAmount,
        due_amount: due,
      };
    });
  }

  private async getQuoteInternal(quoteId: string) {
    const quoteUrl = this.config.get<string>('QUOTES_INTERNAL_URL');
    const apiKey = this.config.get<string>('INTERNAL_API_KEY');
    if (!quoteUrl || !apiKey) {
      throw new Error('QUOTES_INTERNAL_URL o INTERNAL_API_KEY no configurados');
    }
    const { data } = await firstValueFrom(
      this.http.get(`${quoteUrl}/internal/quotes/${quoteId}`, {
        headers: { 'x-internal-api-key': apiKey },
      }),
    );
    return data;
  }

  private async syncQuotePaymentStatus(quoteId: string) {
    const payments = await this.payments.find({ where: { quote_id: quoteId, status: 'confirmed' } });
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const quote = await this.getQuoteInternal(quoteId);
    const totalPrice = Number(quote.price ?? 0);
    const status = totalPaid >= totalPrice ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'sent';

    const quoteUrl = this.config.get<string>('QUOTES_INTERNAL_URL');
    const apiKey = this.config.get<string>('INTERNAL_API_KEY');
    if (!quoteUrl || !apiKey) return;

    await firstValueFrom(
      this.http.patch(
        `${quoteUrl}/internal/quotes/${quoteId}/payment-status`,
        { status, paid_amount: totalPaid },
        { headers: { 'x-internal-api-key': apiKey } },
      ),
    );
  }
}
