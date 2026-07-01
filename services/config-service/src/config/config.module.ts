import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerConfig } from '../entities/customer-config.entity';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerConfig])],
  controllers: [ConfigController],
  providers: [ConfigService],
})
export class ConfigModule {}
