import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from '../entities/quote.entity';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { InternalController } from '../internal/internal.controller';
import { InternalApiKeyGuard } from '../common/internal-auth.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TypeOrmModule.forFeature([Quote]), ConfigModule],
  controllers: [QuotesController, InternalController],
  providers: [QuotesService, InternalApiKeyGuard],
})
export class QuotesModule {}
