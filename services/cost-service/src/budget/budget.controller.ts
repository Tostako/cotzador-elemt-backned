import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { BudgetService } from './budget.service';
import { AddItemDto, UpdateItemDto, ValidateBudgetDto } from './budget.dto';

@Controller('costos/projects/:projectId')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('budget')
  listarItems(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.budgetService.listarItems(user.shop_id, user.customer_id, projectId);
  }

  @Post('budget/items')
  agregarItem(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddItemDto,
  ) {
    return this.budgetService.agregarItem(user.shop_id, user.customer_id, projectId, dto, user.email);
  }

  @Patch('budget/items/:itemId')
  actualizarItem(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.budgetService.actualizarItem(user.shop_id, user.customer_id, projectId, itemId, dto, user.email);
  }

  @Delete('budget/items/:itemId')
  eliminarItem(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.budgetService.eliminarItem(user.shop_id, user.customer_id, projectId, itemId, user.email);
  }

  @Post('budget/validate')
  validar(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ValidateBudgetDto,
  ) {
    return this.budgetService.validar(user.shop_id, user.customer_id, projectId);
  }

  @Post('undo')
  deshacer(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: { undo_token: string },
  ) {
    return this.budgetService.deshacer(user.shop_id, user.customer_id, body.undo_token);
  }
}