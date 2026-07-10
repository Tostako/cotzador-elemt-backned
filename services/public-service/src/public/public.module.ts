import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from '../entities/shop.entity';
import { SiteConfig } from '../entities/site-config.entity';
import { LandingImage } from '../entities/landing-image.entity';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';

@Module({
  imports: [
    CacheModule.register({
      ttl: 30 * 60 * 1000, // 30 minutos
      max: 100,            // máximo 100 entradas en caché
    }),
    TypeOrmModule.forFeature([Shop, SiteConfig, LandingImage]),
  ],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
