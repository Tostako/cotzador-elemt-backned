import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { AiService } from './ai.service';
import { GenerarPropuestaApuDto } from './ai.dto';

@Controller('costos/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('apu-proposals')
  proponer(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: GenerarPropuestaApuDto,
  ) {
    return this.aiService.proponerApu(user.shop_id, dto.solicitud, dto.capitulo_sugerido);
  }

  @Post('apu-proposals/:proposalId/accept')
  aceptar(
    @CurrentUser() user: CurrentUserData,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
  ) {
    return this.aiService.aceptarPropuesta(user.shop_id, proposalId);
  }
}