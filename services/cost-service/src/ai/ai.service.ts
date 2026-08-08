import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Apu } from '../entities/apu.entity';
import { Supply } from '../entities/supply.entity';
import { BudgetItem } from '../entities/budget-item.entity';

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(Apu) private readonly apuRepo: Repository<Apu>,
    @InjectRepository(Supply) private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(BudgetItem) private readonly itemRepo: Repository<BudgetItem>,
  ) {}

  /**
   * Modo local: resuelve la consulta únicamente con datos de la base propia.
   * No llama ningún modelo externo ni inventa precios.
   */
  async consultarLocal(
    shopId: string,
    customerId: string,
    consulta: string,
    projectId?: string,
  ) {
    if (!consulta || !consulta.trim()) {
      throw new HttpException(
        { tipo: 'PETICION_INVALIDA', mensaje: 'La consulta es obligatoria' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const q = `%${consulta.trim().toLowerCase()}%`;

    // APUs que coinciden por código o descripción.
    const apusRelacionados = await this.apuRepo.createQueryBuilder('a')
      .where('a.shop_id = :shopId', { shopId })
      .andWhere('a.deleted_at IS NULL')
      .andWhere('(LOWER(a.codigo) LIKE :q OR LOWER(a.descripcion) LIKE :q)', { q })
      .orderBy('LENGTH(a.descripcion)', 'ASC')
      .take(8)
      .getMany();

    // Actividades del proyecto que coinciden.
    let actividadesEnProyecto = [];
    if (projectId) {
      actividadesEnProyecto = await this.itemRepo.createQueryBuilder('i')
        .where('i.project_id = :projectId', { projectId })
        .andWhere('i.deleted_at IS NULL')
        .andWhere('(LOWER(i.descripcion) LIKE :q OR LOWER(i.unidad) LIKE :q)', { q })
        .orderBy('i.created_at', 'ASC')
        .take(8)
        .getMany();
    }

    return {
      modo: 'LOCAL',
      consulta: consulta.trim(),
      apus_relacionados: apusRelacionados,
      actividades_en_proyecto: actividadesEnProyecto,
      origen: 'base_local',
      aviso: 'Modo local: sin conexión a un modelo externo',
    };
  }
}