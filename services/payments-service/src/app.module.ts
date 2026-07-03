import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { PaymentPlan } from './entities/payment-plan.entity';
import { Payment } from './entities/payment.entity';
import { PlansModule } from './plans/plans.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL') || config.get<string>('SUPABASE_DATABASE_URL'),
        schema: config.get<string>('DATABASE_SCHEMA') || config.get<string>('PAYMENTS_DATABASE_SCHEMA') || undefined,
        entities: [PaymentPlan, Payment],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    PlansModule,
    PaymentsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
