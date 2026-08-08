import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apu } from '../entities/apu.entity';
import { Supply } from '../entities/supply.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [TypeOrmModule.forFeature([Apu, Supply, BudgetItem])],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}