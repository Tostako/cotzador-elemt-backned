import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ConsultaLocalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  consulta: string;

  @IsUUID()
  @IsOptional()
  project_id?: string;
}