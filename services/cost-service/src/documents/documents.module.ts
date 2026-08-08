import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../entities/document.entity';
import { Project } from '../entities/project.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Apu } from '../entities/apu.entity';
import { Supply } from '../entities/supply.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Project, BudgetItem, Apu, Supply])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}