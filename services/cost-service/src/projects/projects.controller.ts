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
} from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { ProjectsService } from './projects.service';
import { AiuConfigDto, CreateProjectDto, ListProjectsQueryDto, UpdateProjectDto } from './projects.dto';

@Controller('costos/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  listar(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ListProjectsQueryDto,
  ) {
    return this.projectsService.listar(user.shop_id, user.customer_id, query as any);
  }

  @Get('paperera')
  papelera(@CurrentUser() user: CurrentUserData) {
    return this.projectsService.listar(user.shop_id, user.customer_id, { estado: 'PAPELERA' });
  }

  @Post()
  crear(@CurrentUser() user: CurrentUserData, @Body() dto: CreateProjectDto) {
    return this.projectsService.crear(user.shop_id, user.customer_id, dto);
  }

  @Get(':id')
  obtener(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.obtener(user.shop_id, user.customer_id, id);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.projectsService.actualizar(user.shop_id, user.customer_id, id, dto, ifMatch);
  }

  @Patch(':id/aiu')
  actualizarAiu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AiuConfigDto,
  ) {
    return this.projectsService.actualizarAiu(user.shop_id, user.customer_id, id, dto);
  }

  @Get(':id/aiu')
  obtenerAiu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.obtenerAiu(user.shop_id, user.customer_id, id);
  }

  @Put(':id/aiu')
  guardarAiu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AiuConfigDto,
  ) {
    return this.projectsService.actualizarAiu(user.shop_id, user.customer_id, id, dto);
  }

  @Delete(':id')
  eliminar(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.eliminar(user.shop_id, user.customer_id, id);
  }

  @Post(':id/restaurar')
  restaurar(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.restaurar(user.shop_id, user.customer_id, id);
  }
}