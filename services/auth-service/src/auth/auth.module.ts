import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from '../entities/shop.entity';
import { Customer } from '../entities/customer.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, Customer])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
