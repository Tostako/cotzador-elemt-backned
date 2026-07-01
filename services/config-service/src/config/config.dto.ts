import { IsObject, IsOptional } from 'class-validator';

/** Todas las claves son opcionales: el frontend permite guardados parciales. */
export class UpdateConfigDto {
  @IsOptional() @IsObject() services?: Record<string, unknown>;
  @IsOptional() @IsObject() sub_packages?: Record<string, unknown>;
  @IsOptional() @IsObject() complete_package?: Record<string, unknown>;
  @IsOptional() @IsObject() payment_plan?: Record<string, unknown>;
  @IsOptional() @IsObject() invoice?: Record<string, unknown>;
  @IsOptional() @IsObject() estimation?: Record<string, unknown>;
}
