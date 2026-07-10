import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../entities/shop.entity';
import { SiteConfig } from '../entities/site-config.entity';
import { LandingImage } from '../entities/landing-image.entity';

@Injectable()
export class PublicService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(SiteConfig) private readonly configs: Repository<SiteConfig>,
    @InjectRepository(LandingImage) private readonly images: Repository<LandingImage>,
  ) {}

  private async shopId(slug: string): Promise<string> {
    const cacheKey = `shop:id:${slug}`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const shop = await this.shops.findOne({ where: { slug } });
    if (!shop) throw new NotFoundException(`Tienda '${slug}' no encontrada`);
    await this.cache.set(cacheKey, shop.id, 30 * 60 * 1000);
    return shop.id;
  }

  async siteConfig(slug: string) {
    const cacheKey = `public:site-config:${slug}`;
    const cached = await this.cache.get<Record<string, Record<string, string>>>(cacheKey);
    if (cached) return cached;

    const shopId = await this.shopId(slug);
    const rows = await this.configs.find({ where: { shop_id: shopId, active: true } });
    // Agrupa por sección: { hero: { title: ... }, theme: { ... } }
    const grouped: Record<string, Record<string, string>> = {};
    for (const r of rows) {
      (grouped[r.section] ??= {})[r.key] = r.value;
    }
    await this.cache.set(cacheKey, grouped, 30 * 60 * 1000);
    return grouped;
  }

  async landingImages(slug: string) {
    const cacheKey = `public:landing-images:${slug}`;
    const cached = await this.cache.get<LandingImage[]>(cacheKey);
    if (cached) return cached;

    const shopId = await this.shopId(slug);
    const rows = await this.images.find({
      where: { shop_id: shopId, active: true },
      order: { type: 'ASC', order: 'ASC' },
    });
    await this.cache.set(cacheKey, rows, 30 * 60 * 1000);
    return rows;
  }
}
