import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CornisasProject } from '../entities/cornisas-project.entity';
import { CornisasService } from './cornisas.service';
import { CornisasController } from './cornisas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CornisasProject])],
  providers: [CornisasService],
  controllers: [CornisasController],
})
export class CornisasModule {}
