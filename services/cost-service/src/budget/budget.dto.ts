import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AddItemDto {
  @IsUUID()
  apu_id: string;

  @IsUUID()
  @IsOptional()
  chapter_id?: string;

  @IsNumber()
  @Min(0)
  cantidad: number;

  @IsBoolean()
  @IsOptional()
  dry_run?: boolean;
}

export class UpdateItemDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  cantidad?: number;

  @IsUUID()
  @IsOptional()
  chapter_id?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  descripcion?: string;
}

export class ValidateBudgetDto {
  @IsBoolean()
  @IsOptional()
  incluir_avisos?: boolean;
}