import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quotation } from '../entities/quotation.entity';
import { QuotationLine } from '../entities/quotation-line.entity';
import { Project } from '../entities/project.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Supply } from '../entities/supply.entity';
import { SupplyPrice } from '../entities/supply-price.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CostEngineModule } from '../cost-engine/cost-engine.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quotation, QuotationLine, Project, BudgetItem, Supply, SupplyPrice]),
    AnalyticsModule,
    CostEngineModule,
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}