import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { Shop } from './entities/shop.entity';
import { SiteConfig } from './entities/site-config.entity';
import { LandingImage } from './entities/landing-image.entity';
import { PublicModule } from './public/public.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL') || config.get<string>('SUPABASE_DATABASE_URL'),
        schema: config.get<string>('DATABASE_SCHEMA') || config.get<string>('PUBLIC_DATABASE_SCHEMA') || undefined,
        entities: [Shop, SiteConfig, LandingImage],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    PublicModule,
    HealthModule,
  ],
  // Guard global, pero todas las rutas de este servicio son @Public()
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
