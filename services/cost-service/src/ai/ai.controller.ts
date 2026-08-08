import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { AiService } from './ai.service';
import { ConsultaLocalDto } from './ai.dto';

@Controller('costos/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('query')
  consultar(@CurrentUser() user: CurrentUserData, @Body() dto: ConsultaLocalDto) {
    return this.aiService.consultarLocal(
      user.shop_id,
      user.customer_id,
      dto.consulta,
      dto.project_id,
    );
  }
}