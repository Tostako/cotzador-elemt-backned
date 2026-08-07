import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { Supply } from '../entities/supply.entity';
import { SupplyPrice } from '../entities/supply-price.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Chapter } from '../entities/chapter.entity';
import { CostEngine } from './cost-engine.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Apu, ApuComponent, Supply, SupplyPrice, BudgetItem, Chapter]),
  ],
  providers: [CostEngine],
  exports: [CostEngine],
})
export class CostEngineModule {}