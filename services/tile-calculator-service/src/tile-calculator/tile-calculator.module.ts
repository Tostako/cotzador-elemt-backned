import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TileProject } from '../entities/tile-project.entity';
import { TileCalculatorService } from './tile-calculator.service';
import { TileCalculatorController } from './tile-calculator.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TileProject])],
  controllers: [TileCalculatorController],
  providers: [TileCalculatorService],
})
export class TileCalculatorModule {}
