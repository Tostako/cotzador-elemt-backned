import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CalculatorService } from './calculator.service';
import { CalculateSpaceDto, CalculateOffcutsDto, CalculateProjectDto } from './calculator.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('tile-calculator')
export class CalculatorController {
  constructor(private readonly calculator: CalculatorService) {}

  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get('patterns')
  patterns() {
    return this.calculator.getPatterns();
  }

  @Post('calculate')
  calculateSpace(@Body() dto: CalculateSpaceDto) {
    return this.calculator.calculateSpace(dto);
  }

  @Post('offcuts')
  calculateOffcuts(@Body() dto: CalculateOffcutsDto) {
    return this.calculator.calculateOffcuts(dto);
  }

  @Post('projects/:id/calculate')
  calculateProject(
    @CurrentUser() u: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: CalculateProjectDto,
  ) {
    return this.calculator.calculateProject(this.ctx(u), id, dto);
  }
}
