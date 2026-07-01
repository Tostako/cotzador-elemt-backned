import { IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

const STATUSES = ['draft', 'sent', 'paid', 'completed', 'partially_paid'];

export class CreateQuoteDto {
  @IsOptional() @IsString() date?: string;
  @IsString() client: string;
  @IsString() project: string;
  @IsNumber() area: number;
  @IsNumber() price: number;
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsObject() data: any;
}

export class UpdateQuoteDto {
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsString() project?: string;
  @IsOptional() @IsNumber() area?: number;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsObject() data?: any;
}

export class SelectPlanDto {
  @IsUUID() payment_plan_id: string;
}
