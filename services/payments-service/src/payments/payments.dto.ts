import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsInt() installmentIndex: number;
  @IsNumber() amount: number;
  @IsString() method: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() paidAt?: string;
}
