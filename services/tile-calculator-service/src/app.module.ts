import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { TileProject } from './entities/tile-project.entity';
import { TileCalculatorModule } from './tile-calculator/tile-calculator.module';
import { CalculatorModule } from './calculator/calculator.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL') || config.get<string>('SUPABASE_DATABASE_URL'),
        schema: config.get<string>('DATABASE_SCHEMA') || config.get<string>('TILE_CALCULATOR_DATABASE_SCHEMA') || undefined,
        entities: [TileProject],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    TileCalculatorModule,
    CalculatorModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
