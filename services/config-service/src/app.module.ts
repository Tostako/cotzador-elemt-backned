import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { CustomerConfig } from './entities/customer-config.entity';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [NestConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL') || config.get<string>('SUPABASE_DATABASE_URL'),
        schema: config.get<string>('DATABASE_SCHEMA') || config.get<string>('CONFIG_DATABASE_SCHEMA') || undefined,
        entities: [CustomerConfig],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
