import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousePlan } from '../entities/house-plan.entity';
import { TileProject } from '../entities/tile-project.entity';
import { GuardaescobasProject } from '../entities/guardaescobas-project.entity';
import { HousePlansService } from './house-plans.service';
import { HousePlansController } from './house-plans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HousePlan, TileProject, GuardaescobasProject])],
  providers: [HousePlansService],
  controllers: [HousePlansController],
})
export class HousePlansModule {}
