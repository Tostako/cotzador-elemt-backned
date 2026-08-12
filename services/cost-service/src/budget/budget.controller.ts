import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { BudgetService } from './budget.service';
import { AddItemDto, UpdateItemDto, ValidateBudgetDto, EditarApuSnapshotDto } from './budget.dto';

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
    @Headers('if-match') ifMatch?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.budgetService
      .actualizarItem(user.shop_id, user.customer_id, projectId, itemId, dto, user.email, ifMatch)
      .then((resultado) => {
        if (resultado?.etag) res?.setHeader('ETag', resultado.etag);
        return resultado;
      });
  }

  @Delete('budget/items/:itemId')
  eliminarItem(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.budgetService.eliminarItem(user.shop_id, user.customer_id, projectId, itemId, user.email);
  }

  @Post('budget/items/:itemId/apu/promote')
  promoverApu(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('dryRun') dryRun?: string,
    @Headers('x-confirmation-token') confirmationToken?: string,
  ) {
    return this.budgetService.promoverApu(
      user.shop_id,
      user.customer_id,
      projectId,
      itemId,
      user.role,
      dryRun === 'true' || dryRun === '1',
      confirmationToken,
    );
  }

  @Get('budget/items/:itemId/apu')
  obtenerApuSnapshot(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.budgetService.obtenerApuSnapshot(user.shop_id, user.customer_id, projectId, itemId);
  }

  @Put('budget/items/:itemId/apu')
  editarApuSnapshot(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: EditarApuSnapshotDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.budgetService.editarApuSnapshot(
      user.shop_id,
      user.customer_id,
      projectId,
      itemId,
      dto,
      ifMatch,
      user.email,
    );
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