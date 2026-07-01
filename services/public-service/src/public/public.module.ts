import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from '../entities/shop.entity';
import { SiteConfig } from '../entities/site-config.entity';
import { LandingImage } from '../entities/landing-image.entity';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, SiteConfig, LandingImage])],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
