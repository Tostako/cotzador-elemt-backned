import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chapter } from '../entities/chapter.entity';
import { Apu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Project } from '../entities/project.entity';
import { Supply } from '../entities/supply.entity';
import { SupplyPrice } from '../entities/supply-price.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([Chapter, Apu, ApuComponent, BudgetItem, Project, Supply, SupplyPrice])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}