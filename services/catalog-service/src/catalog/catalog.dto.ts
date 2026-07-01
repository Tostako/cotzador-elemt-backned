import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateCategoryDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
}

export class CreateProductDto {
  @IsUUID() category_id: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() sku?: string;
}

export class CreatePriceDto {
  @IsString() hardware_store: string;
  @IsOptional() @IsString() brand?: string;
  @IsNumber() price: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdatePriceDto {
  @IsOptional() @IsString() hardware_store?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() notes?: string;
}

export class OrderItemDto {
  @IsUUID() product_id: string;
  @IsUUID() price_id: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateOrderDto {
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
}
