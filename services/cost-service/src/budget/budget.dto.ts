import {
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class EditarApuSnapshotDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  descripcion?: string;

  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ComponenteSnapshotDto)
  componentes?: ComponenteSnapshotDto[];
}

export class ComponenteSnapshotDto {
  @IsUUID()
  insumo_id: string;

  @IsNumber()
  @Min(0.0001)
  rendimiento: number;
}