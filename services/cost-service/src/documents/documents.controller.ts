import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { DocumentsService } from './documents.service';
import { GenerarDocumentoDto } from './documents.dto';

@Controller('costos')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('projects/:projectId/documents')
  generar(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: GenerarDocumentoDto,
  ) {
    return this.documentsService.generar(user.shop_id, user.customer_id, projectId, dto);
  }

  @Get('documents/:docId')
  estado(
    @CurrentUser() user: CurrentUserData,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.documentsService.obtenerEstado(user.shop_id, user.customer_id, docId);
  }

  @Get('documents/:docId/file')
  @Header('Content-Type', 'application/pdf')
  async descargar(
    @CurrentUser() user: CurrentUserData,
    @Param('docId', ParseUUIDPipe) docId: string,
  ): Promise<StreamableFile> {
    const doc = await this.documentsService.obtenerEstado(user.shop_id, user.customer_id, docId);
    const path = this.documentsService.rutaArchivo(doc.file_path!);
    return new StreamableFile(createReadStream(path));
  }
}