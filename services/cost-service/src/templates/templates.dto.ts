import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class AplicarPlantillaDto {
  @IsString()
  templateId: string;

  @IsIn(['REEMPLAZAR', 'AGREGAR'])
  @IsOptional()
  modo?: 'REEMPLAZAR' | 'AGREGAR';
}