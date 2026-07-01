import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class InstallmentDto {
  @IsString() name: string;
  @IsNumber() percentage: number;
  @IsInt() order: number;
}

export class PaymentPlanDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InstallmentDto) installments: InstallmentDto[];
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
