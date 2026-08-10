import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { Supply } from '../entities/supply.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Chapter } from '../entities/chapter.entity';
import { AiApuProposal } from '../entities/ai-apu-proposal.entity';
import { CostEngineModule } from '../cost-engine/cost-engine.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Apu, ApuComponent, Supply, BudgetItem, Chapter, AiApuProposal]),
    CostEngineModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}