import { IsIn, IsNumber, IsOptional } from 'class-validator';

const STATUSES = ['draft', 'sent', 'paid', 'completed', 'partially_paid'];

export class UpdatePaymentStatusDto {
  @IsIn(STATUSES) status: string;
  @IsOptional() @IsNumber() paid_amount?: number;
}
