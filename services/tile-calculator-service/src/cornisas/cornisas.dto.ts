import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CornisasMaterialDto {
  @IsString() @MaxLength(50) id: string;
  @IsString() @MaxLength(120) nombre: string;
  @IsString() @MaxLength(60) tipo: string;
  @IsOptional() @MaxLength(60) color?: string;
  @IsOptional() @IsNumber() altura?: number;
  @IsIn(['metro', 'tira']) modo: 'metro' | 'tira';
  @IsOptional() @IsNumber() precio_por_metro?: number;
  @IsOptional() @IsNumber() largo_cm?: number;
  @IsOptional() @IsNumber() precio_por_tira?: number;
}

export class CreateCornisasProjectDto {
  @IsString() @MaxLength(120) nombre: string;
}

export class UpdateCornisasProjectDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CornisasMaterialDto) materiales?: CornisasMaterialDto[];
  @IsOptional() @IsObject() resultados?: Record<string, unknown>;
}
