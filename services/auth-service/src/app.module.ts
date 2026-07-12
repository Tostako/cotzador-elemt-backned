import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { Shop } from './entities/shop.entity';
import { Customer } from './entities/customer.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthModule } from './auth/auth.module';

import { CustomersModule } from './customers/customers.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL') || config.get<string>('SUPABASE_DATABASE_URL'),
        schema: config.get<string>('DATABASE_SCHEMA') || config.get<string>('AUTH_DATABASE_SCHEMA') || undefined,
        entities: [Shop, Customer, RefreshToken],
        synchronize: false,
        retryAttempts: 3,
        retryDelay: 3000,
        extra: {
          max: 3,
          min: 1,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    CustomersModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}



