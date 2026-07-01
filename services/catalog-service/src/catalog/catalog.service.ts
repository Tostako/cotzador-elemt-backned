import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Price) private readonly prices: Repository<Price>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
    private readonly ds: DataSource,
  ) {}

  // -------- Categorías --------
  listCategories(ctx: Ctx) {
    return this.categories.find({ where: { ...ctx }, order: { name: 'ASC' } });
  }
  createCategory(ctx: Ctx, dto: CreateCategoryDto) {
    return this.categories.save(this.categories.create({ ...ctx, ...dto }));
  }
  async deleteCategory(ctx: Ctx, id: string) {
    const r = await this.categories.delete({ id, ...ctx });
    if (!r.affected) throw new NotFoundException('Categoría no encontrada');
    return { ok: true };
  }

  // -------- Productos --------
  async listProducts(ctx: Ctx, categoryId?: string) {
    const where = categoryId ? { ...ctx, category_id: categoryId } : { ...ctx };
    const products = await this.products.find({ where, order: { name: 'ASC' } });
    return Promise.all(products.map((p) => this.withPrices(ctx, p)));
  }
  async getProduct(ctx: Ctx, id: string) {
    const p = await this.products.findOne({ where: { id, ...ctx } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return this.withPrices(ctx, p);
  }
  createProduct(ctx: Ctx, dto: CreateProductDto) {
    return this.products.save(this.products.create({ ...ctx, ...dto }));
  }
  async deleteProduct(ctx: Ctx, id: string) {
    const r = await this.products.delete({ id, ...ctx });
    if (!r.affected) throw new NotFoundException('Producto no encontrado');
    return { ok: true };
  }
  private async withPrices(ctx: Ctx, p: Product) {
    const prices = await this.prices.find({ where: { ...ctx, product_id: p.id }, order: { price: 'ASC' } });
    const lowest = prices.length ? Math.min(...prices.map((x) => Number(x.price))) : null;
    return { ...p, prices, lowest_price: lowest, prices_count: prices.length };
  }

  // -------- Precios --------
  async addPrice(ctx: Ctx, productId: string, dto: CreatePriceDto) {
    await this.getProduct(ctx, productId);
    return this.prices.save(this.prices.create({ ...ctx, product_id: productId, ...dto }));
  }
  async updatePrice(ctx: Ctx, productId: string, priceId: string, dto: UpdatePriceDto) {
    const r = await this.prices.update({ id: priceId, product_id: productId, ...ctx }, dto);
    if (!r.affected) throw new NotFoundException('Precio no encontrado');
    return this.prices.findOne({ where: { id: priceId } });
  }
  async deletePrice(ctx: Ctx, productId: string, priceId: string) {
    const r = await this.prices.delete({ id: priceId, product_id: productId, ...ctx });
    if (!r.affected) throw new NotFoundException('Precio no encontrado');
    return { ok: true };
  }

  // -------- Pedidos --------
  async listOrders(ctx: Ctx) {
    const orders = await this.orders.find({ where: { ...ctx }, order: { created_at: 'DESC' } });
    return Promise.all(
      orders.map(async (o) => ({ ...o, items: await this.items.find({ where: { order_id: o.id } }) })),
    );
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
