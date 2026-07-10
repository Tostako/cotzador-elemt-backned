import { Body, Controller, Patch } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { UpdateProfileDto } from './customers.dto';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('customers')
export class CustomersController {
  constructor(@InjectRepository(Customer) private readonly customers: Repository<Customer>) {}

  @Patch('me')
  async updateMe(
    @CurrentUser('customer_id') id: string,
    @CurrentUser('shop_id') shopId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    await this.customers.update({ id, shop_id: shopId }, dto);
    return this.customers.findOne({ where: { id, shop_id: shopId } });
  }
}
