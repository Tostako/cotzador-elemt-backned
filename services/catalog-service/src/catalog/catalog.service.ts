import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { Price } from '../entities/price.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { CreateCategoryDto, CreateOrderDto, CreatePriceDto, CreateProductDto, UpdatePriceDto } from './catalog.dto';

interface Ctx { shop_id: string; customer_id: string; }

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Price) private readonly prices: Repository<Price>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
    private readonly ds: DataSource,
  ) {}

  private categoriesKey(ctx: Ctx) {
    return `catalog:categories:${ctx.shop_id}:${ctx.customer_id}`;
  }

  private productsKey(ctx: Ctx, categoryId?: string) {
    return `catalog:products:${ctx.shop_id}:${ctx.customer_id}:${categoryId ?? 'all'}`;
  }

  private async clearCatalogCache(ctx: Ctx) {
    await this.cache.del(this.categoriesKey(ctx));
    await this.cache.del(this.productsKey(ctx));
  }

  // -------- Categorías --------
  async listCategories(ctx: Ctx) {
    const key = this.categoriesKey(ctx);
    const cached = await this.cache.get<Category[]>(key);
    if (cached) return cached;

    const rows = await this.categories.find({ where: { ...ctx }, order: { name: 'ASC' } });
    await this.cache.set(key, rows, 5 * 60 * 1000);
    return rows;
  }

  async createCategory(ctx: Ctx, dto: CreateCategoryDto) {
    await this.clearCatalogCache(ctx);
    return this.categories.save(this.categories.create({ ...ctx, ...dto }));
  }

  async deleteCategory(ctx: Ctx, id: string) {
    const r = await this.categories.delete({ id, ...ctx });
    if (!r.affected) throw new NotFoundException('Categoría no encontrada');
    await this.clearCatalogCache(ctx);
    return { ok: true };
  }

  // -------- Productos --------
  async listProducts(ctx: Ctx, categoryId?: string) {
    const useCache = !categoryId;
    const key = this.productsKey(ctx);

    if (useCache) {
      const cached = await this.cache.get<{ product: Product; prices: Price[]; lowest_price: number | null; prices_count: number }[]>(key);
      if (cached) return cached;
    }

    const where = categoryId ? { ...ctx, category_id: categoryId } : { ...ctx };
    const products = await this.products.find({ where, order: { name: 'ASC' } });
    if (products.length === 0) return [];

    // Una sola query para precios de todos los productos (evita N+1).
    const productIds = products.map((p) => p.id);
    const allPrices = await this.prices.find({
      where: { ...ctx, product_id: In(productIds) },
      order: { price: 'ASC' },
    });

    const pricesByProduct = new Map<string, Price[]>();
    for (const price of allPrices) {
      const list = pricesByProduct.get(price.product_id) ?? [];
      list.push(price);
      pricesByProduct.set(price.product_id, list);
    }

    const result = products.map((p) => {
      const prices = pricesByProduct.get(p.id) ?? [];
      return this.buildProductWithPrices(p, prices);
    });

    if (useCache) {
      await this.cache.set(key, result, 5 * 60 * 1000);
    }
    return result;
  }

  async getProduct(ctx: Ctx, id: string) {
    const p = await this.products.findOne({ where: { id, ...ctx } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    const prices = await this.prices.find({ where: { ...ctx, product_id: p.id }, order: { price: 'ASC' } });
    return this.buildProductWithPrices(p, prices);
  }

  async createProduct(ctx: Ctx, dto: CreateProductDto) {
    await this.clearCatalogCache(ctx);
    return this.products.save(this.products.create({ ...ctx, ...dto }));
  }

  async deleteProduct(ctx: Ctx, id: string) {
    const r = await this.products.delete({ id, ...ctx });
    if (!r.affected) throw new NotFoundException('Producto no encontrado');
    await this.clearCatalogCache(ctx);
    return { ok: true };
  }

  private buildProductWithPrices(p: Product, prices: Price[]) {
    const lowest = prices.length
      ? prices.reduce((min, x) => Math.min(min, Number(x.price)), Infinity)
      : null;
    return { ...p, prices, lowest_price: lowest === Infinity ? null : lowest, prices_count: prices.length };
  }

  // -------- Precios --------
  async addPrice(ctx: Ctx, productId: string, dto: CreatePriceDto) {
    await this.getProduct(ctx, productId);
    const result = await this.prices.save(this.prices.create({ ...ctx, product_id: productId, ...dto }));
    await this.clearCatalogCache(ctx);
    return result;
  }

  async updatePrice(ctx: Ctx, productId: string, priceId: string, dto: UpdatePriceDto) {
    const r = await this.prices.update({ id: priceId, product_id: productId, ...ctx }, dto);
    if (!r.affected) throw new NotFoundException('Precio no encontrado');
    await this.clearCatalogCache(ctx);
    return this.prices.findOne({ where: { id: priceId } });
  }

  async deletePrice(ctx: Ctx, productId: string, priceId: string) {
    const r = await this.prices.delete({ id: priceId, product_id: productId, ...ctx });
    if (!r.affected) throw new NotFoundException('Precio no encontrado');
    await this.clearCatalogCache(ctx);
    return { ok: true };
  }

  // -------- Pedidos --------
  async listOrders(ctx: Ctx) {
    const orders = await this.orders.find({ where: { ...ctx }, order: { created_at: 'DESC' } });
    if (orders.length === 0) return [];

    // Una sola query para items de todas las órdenes (evita N+1).
    const orderIds = orders.map((o) => o.id);
    const allItems = await this.items.find({ where: { order_id: In(orderIds) } });

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const item of allItems) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    return orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
  }

  async createOrder(ctx: Ctx, dto: CreateOrderDto) {
    const priceIds = dto.items.map((i) => i.price_id);
    const prices = await this.prices.find({ where: { id: In(priceIds), ...ctx } });
    const priceMap = new Map(prices.map((p) => [p.id, p]));

    let subtotal = 0;
    const itemsData = dto.items.map((i) => {
      const price = priceMap.get(i.price_id);
      if (!price || price.product_id !== i.product_id) {
        throw new BadRequestException(`Precio inválido para el producto ${i.product_id}`);
      }
      const unit = Number(price.price);
      const line = unit * i.quantity;
      subtotal += line;
      return { ...ctx, product_id: i.product_id, price_id: i.price_id,
        quantity: i.quantity, unit_price: unit, subtotal: line };
    });

    return this.ds.transaction(async (m) => {
      const order = await m.save(m.create(Order, {
        ...ctx, status: 'pending', notes: dto.notes, subtotal, total: subtotal,
      }));
      const items = itemsData.map((it) => m.create(OrderItem, { ...it, order_id: order.id }));
      await m.save(items);
      return { ...order, items };
    });
  }
}
