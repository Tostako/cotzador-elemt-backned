import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TileProject } from '../entities/tile-project.entity';
import { CalculatorService } from './calculator.service';
import { CalculatorController } from './calculator.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TileProject])],
  controllers: [CalculatorController],
  providers: [CalculatorService],
})
export class CalculatorModule {}
