import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto, CreateOrderDto, CreatePriceDto, CreateProductDto, UpdatePriceDto,
} from './catalog.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('quote-catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  // Categorías
  @Get('categories') listCategories(@CurrentUser() u: CurrentUserData) {
    return this.catalog.listCategories(this.ctx(u));
  }
  @Post('categories') createCategory(@CurrentUser() u: CurrentUserData, @Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(this.ctx(u), dto);
  }
  @Delete('categories/:id') deleteCategory(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.catalog.deleteCategory(this.ctx(u), id);
  }

  // Productos
  @Get('products') listProducts(@CurrentUser() u: CurrentUserData, @Query('category_id') categoryId?: string) {
    return this.catalog.listProducts(this.ctx(u), categoryId);
  }
  @Get('products/:id') getProduct(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.catalog.getProduct(this.ctx(u), id);
  }
  @Post('products') createProduct(@CurrentUser() u: CurrentUserData, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(this.ctx(u), dto);
  }
  @Delete('products/:id') deleteProduct(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.catalog.deleteProduct(this.ctx(u), id);
  }

  // Precios
  @Post('products/:productId/prices')
  addPrice(@CurrentUser() u: CurrentUserData, @Param('productId') pid: string, @Body() dto: CreatePriceDto) {
    return this.catalog.addPrice(this.ctx(u), pid, dto);
  }
  @Patch('products/:productId/prices/:priceId')
  updatePrice(@CurrentUser() u: CurrentUserData, @Param('productId') pid: string, @Param('priceId') prid: string, @Body() dto: UpdatePriceDto) {
    return this.catalog.updatePrice(this.ctx(u), pid, prid, dto);
  }
  @Delete('products/:productId/prices/:priceId')
  deletePrice(@CurrentUser() u: CurrentUserData, @Param('productId') pid: string, @Param('priceId') prid: string) {
    return this.catalog.deletePrice(this.ctx(u), pid, prid);
  }

  // Pedidos
  @Get('orders') listOrders(@CurrentUser() u: CurrentUserData) {
    return this.catalog.listOrders(this.ctx(u));
  }
  @Post('orders') createOrder(@CurrentUser() u: CurrentUserData, @Body() dto: CreateOrderDto) {
    return this.catalog.createOrder(this.ctx(u), dto);
  }
}
