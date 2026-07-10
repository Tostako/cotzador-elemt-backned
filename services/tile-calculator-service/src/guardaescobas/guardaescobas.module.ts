import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardaescobasProject } from '../entities/guardaescobas-project.entity';
import { GuardaescobasService } from './guardaescobas.service';
import { GuardaescobasController } from './guardaescobas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GuardaescobasProject])],
  providers: [GuardaescobasService],
  controllers: [GuardaescobasController],
})
export class GuardaescobasModule {}
