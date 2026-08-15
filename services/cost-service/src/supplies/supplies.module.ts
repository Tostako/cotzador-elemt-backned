import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supply } from '../entities/supply.entity';
import { SupplyPrice } from '../entities/supply-price.entity';
import { Apu } from '../entities/apu.entity';
import { ApuComponent } from '../entities/apu-component.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Project } from '../entities/project.entity';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';

@Module({
  imports: [TypeOrmModule.forFeature([Supply, SupplyPrice, Apu, ApuComponent, BudgetItem, Project])],
  controllers: [SuppliesController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}