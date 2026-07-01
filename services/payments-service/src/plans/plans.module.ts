import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentPlan } from '../entities/payment-plan.entity';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentPlan])],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
