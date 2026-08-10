import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerarPropuestaApuDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  solicitud: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  capitulo_sugerido?: string;
}