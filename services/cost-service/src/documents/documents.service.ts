import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { Document } from '../entities/document.entity';
import { Project } from '../entities/project.entity';
import { BudgetItem } from '../entities/budget-item.entity';
import { Apu } from '../entities/apu.entity';
import { Supply } from '../entities/supply.entity';
import { CostEngine } from '../cost-engine/cost-engine.service';
import { GenerarDocumentoDto } from './documents.dto';
import { parseCantidad } from '../common/money';

const STORAGE_DIR = process.env.DOCUMENTS_STORAGE_DIR ?? join(__dirname, '..', '..', 'storage');

const TIPOS_XLSX = ['XLSX_PRESUPUESTO', 'XLSX_INSUMOS', 'XLSX_APUS'];

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly docRepo: Repository<Document>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
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

    const esXlsx = TIPOS_XLSX.includes(dto.tipo);
    const calculo = esXlsx
      ? null
      : await this.costEngine.calcularProyecto(project);
    const doc = this.docRepo.create({
      project_id: project.id,
      tipo: dto.tipo,
      referencia: dto.referencia ?? null,
      total_congelado: calculo?.total ?? null,
      estado: 'GENERANDO',
    });
    const saved = await this.docRepo.save(doc);

    // Generación asíncrona en segundo plano.
    setImmediate(() => {
      const job = esXlsx
        ? this.generarXlsx(project, saved)
        : this.generarPDF(project, calculo as any, saved);
      job.catch(async (err) => {
        saved.estado = 'ERROR';
        saved.error = String(err?.message ?? err).slice(0, 400);
        await this.docRepo.save(saved);
      });
    });

    return saved;
  }

  /** Genera el Excel según el tipo solicitado (HU-21). */
  private async generarXlsx(project: Project, doc: Document) {
    mkdirSync(STORAGE_DIR, { recursive: true });
    const file = `doc-${doc.id}.xlsx`;
    const filePath = join(STORAGE_DIR, file);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CostPro';

    if (doc.tipo === 'XLSX_PRESUPUESTO') {
      await this.hojaPresupuesto(workbook, project);
    } else if (doc.tipo === 'XLSX_INSUMOS') {
      await this.hojaInsumos(workbook, project);
    } else if (doc.tipo === 'XLSX_APUS') {
      await this.hojaApus(workbook, project);
    }

    await workbook.xlsx.writeFile(filePath);

    doc.estado = 'LISTO';
    doc.file_path = file;
    await this.docRepo.save(doc);
  }

  private async hojaPresupuesto(workbook: ExcelJS.Workbook, project: Project) {
    const items = await this.itemRepo.find({
      where: { project_id: project.id, deleted_at: null },
      order: { created_at: 'ASC' },
    });
    const calculo = await this.costEngine.calcularProyecto(project);

    const ws = workbook.addWorksheet('Presupuesto');
    ws.columns = [
      { header: 'Item', key: 'item', width: 6 },
      { header: 'Descripción', key: 'desc', width: 45 },
      { header: 'Unidad', key: 'unidad', width: 10 },
      { header: 'Cantidad', key: 'cant', width: 12 },
      { header: 'Vr unitario', key: 'vu', width: 15 },
      { header: 'Subtotal', key: 'subtotal', width: 15 },
    ];
    items.forEach((i, idx) => {
      ws.addRow({
        item: idx + 1,
        desc: i.descripcion,
        unidad: i.unidad,
        cant: parseCantidad(i.cantidad),
        vu: Number(i.valor_unitario),
        subtotal: Number(calculo.items.find((c) => c.item_id === i.id)?.subtotal ?? i.valor_unitario),
      });
    });
    ws.addRow({});
    ws.addRow({ item: '', desc: 'Costo directo', subtotal: Number(calculo.costo_directo) });
    ws.addRow({ item: '', desc: 'IVA', subtotal: Number(calculo.iva) });
    ws.addRow({ item: '', desc: 'TOTAL', subtotal: Number(calculo.total) });
    ws.getRow(1).font = { bold: true };
  }

  private async hojaInsumos(workbook: ExcelJS.Workbook, project: Project) {
    const supplies = await this.supplyRepo.find({ where: { shop_id: project.shop_id } });
    const ws = workbook.addWorksheet('Insumos');
    ws.columns = [
      { header: 'Insumo', key: 'id', width: 36 },
      { header: 'Descripción', key: 'desc', width: 40 },
      { header: 'Unidad', key: 'unidad', width: 10 },
      { header: 'Grupo', key: 'grupo', width: 12 },
      { header: 'Precio vigente', key: 'precio', width: 15 },
    ];
    for (const s of supplies) {
      const p = await this.costEngine.precioVigente(s.id);
      ws.addRow({
        id: s.id,
        desc: s.descripcion,
        unidad: s.unidad,
        grupo: s.grupo,
        precio: p.existe ? Number(p.valor) : 0,
      });
    }
    ws.getRow(1).font = { bold: true };
  }

  private async hojaApus(workbook: ExcelJS.Workbook, project: Project) {
    const apus = await this.apuRepo.find({
      where: { shop_id: project.shop_id, deleted_at: null },
      order: { codigo: 'ASC' },
    });
    const ws = workbook.addWorksheet('APUs');
    ws.columns = [
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Descripción', key: 'desc', width: 45 },
      { header: 'Unidad', key: 'unidad', width: 10 },
      { header: 'Costo unitario', key: 'cu', width: 15 },
      { header: 'Versión', key: 'version', width: 8 },
    ];
    for (const a of apus) {
      const c = await this.costEngine.costoApu(a.id);
      ws.addRow({ codigo: a.codigo, desc: a.descripcion, unidad: a.unidad, cu: Number(c.costo_unitario), version: a.version });
    }
    ws.getRow(1).font = { bold: true };
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