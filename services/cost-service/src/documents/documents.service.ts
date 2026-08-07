import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import * as PDFDocument from 'pdfkit';
import { Document } from '../entities/document.entity';
import { Project } from '../entities/project.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { GenerarDocumentoDto } from './documents.dto';

const STORAGE_DIR = process.env.DOCUMENTS_STORAGE_DIR ?? join(__dirname, '..', '..', 'storage');

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly docRepo: Repository<Document>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    private readonly costEngine: CostEngine,
  ) {}

  /** Crea el documento en GENERANDO y lanza la generación en segundo plano. */
  async generar(
    shopId: string,
    customerId: string,
    projectId: string,
    dto: GenerarDocumentoDto,
  ): Promise<Document> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId, shop_id: shopId, customer_id: customerId, deleted_at: null },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const calculo = await this.costEngine.calcularProyecto(project);
    const doc = this.docRepo.create({
      project_id: project.id,
      tipo: dto.tipo,
      referencia: dto.referencia ?? null,
      total_congelado: calculo.total,
      estado: 'GENERANDO',
    });
    const saved = await this.docRepo.save(doc);

    // Generación asíncrona en segundo plano.
    setImmediate(() => {
      this.generarPDF(project, calculo as any, saved).catch(async (err) => {
        saved.estado = 'ERROR';
        saved.error = String(err?.message ?? err).slice(0, 400);
        await this.docRepo.save(saved);
      });
    });

    return saved;
  }

  private async generarPDF(
    project: Project,
    calculo: Awaited<ReturnType<CostEngine['calcularProyecto']>>,
    doc: Document,
  ) {
    mkdirSync(STORAGE_DIR, { recursive: true });

    const file = `doc-${doc.id}.pdf`;
    const filePath = join(STORAGE_DIR, file);
    const pdf = new PDFDocument({ size: 'A4', margin: 40 });

    const stream = createWriteStream(filePath);
    pdf.pipe(stream);

    pdf.fontSize(20).fillColor('#111827').text('COTIZACIÓN', { align: 'center' });
    pdf.moveDown(0.4);
    pdf.fontSize(12).fillColor('#4b5563').text(doc.referencia ?? `Referencia: ${doc.id}`, { align: 'center' });
    pdf.moveDown(1);
    pdf.fontSize(13).fillColor('#111827').text(`Proyecto: ${project.nombre}`);
    pdf.fontSize(11).fillColor('#4b5563').text(`Cliente: ${project.cliente ?? '—'}`);
    pdf.text(`Ubicación: ${project.ubicacion ?? '—'}`);
    pdf.text(`Área: ${project.area_m2} m²`);
    pdf.moveDown(1);

    pdf.fontSize(11).fillColor('#111827').text('Ítems del presupuesto', { underline: true });
    pdf.moveDown(0.4);

    for (const item of (calculo as any).items) {
      pdf.fontSize(10).text(
        `${item.descripcion}  |  ${item.cantidad} ${item.unidad}  |  $${item.subtotal}`,
      );
    }

    pdf.moveDown(1);
    pdf.fontSize(11).fillColor('#111827').text(`Costo directo: $${calculo.costo_directo}`);
    pdf.text(`Administración: $${calculo.aiu_desglose.administracion}`);
    pdf.text(`Imprevistos: $${calculo.aiu_desglose.imprevistos}`);
    pdf.text(`Utilidad: $${calculo.aiu_desglose.utilidad}`);
    pdf.moveDown(0.4);
    pdf.fontSize(12).fillColor('#111827').text(`IVA: $${calculo.iva}`);
    pdf.fontSize(14).fillColor('#111827').text(`TOTAL: $${calculo.total}`, { align: 'right' });

    pdf.end();
    await new Promise<void>((resolve) => stream.on('close', () => resolve()));

    doc.estado = 'LISTO';
    doc.file_path = file;
    await this.docRepo.save(doc);
  }

  async obtenerEstado(shopId: string, customerId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const project = await this.projectRepo.findOne({ where: { id: doc.project_id } });
    if (!project || project.shop_id !== shopId || project.customer_id !== customerId) {
      throw new NotFoundException('Documento no encontrado');
    }
    return doc;
  }

  rutaArchivo(almacen: string): string {
    const safe = join(STORAGE_DIR, almacen);
    if (!existsSync(safe)) throw new NotFoundException('Archivo no encontrado');
    return safe;
  }
}