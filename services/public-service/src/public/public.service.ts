import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../entities/shop.entity';
import { SiteConfig } from '../entities/site-config.entity';
import { LandingImage } from '../entities/landing-image.entity';

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(SiteConfig) private readonly configs: Repository<SiteConfig>,
    @InjectRepository(LandingImage) private readonly images: Repository<LandingImage>,
  ) {}

  private async shopId(slug: string): Promise<string> {
    const shop = await this.shops.findOne({ where: { slug } });
    if (!shop) throw new NotFoundException(`Tienda '${slug}' no encontrada`);
    return shop.id;
  }

  async siteConfig(slug: string) {
    const shopId = await this.shopId(slug);
    const rows = await this.configs.find({ where: { shop_id: shopId, active: true } });
    // Agrupa por sección: { hero: { title: ... }, theme: { ... } }
    const grouped: Record<string, Record<string, string>> = {};
    for (const r of rows) {
      (grouped[r.section] ??= {})[r.key] = r.value;
    }
    return grouped;
  }

  async landingImages(slug: string) {
    const shopId = await this.shopId(slug);
    return this.images.find({
      where: { shop_id: shopId, active: true },
      order: { type: 'ASC', order: 'ASC' },
    });
  }
}
