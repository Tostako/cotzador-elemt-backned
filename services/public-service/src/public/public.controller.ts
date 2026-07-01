import { Controller, Get } from '@nestjs/common';
import { PublicService } from './public.service';
import { Public } from '../common/public.decorator';
import { ShopSlug } from '../common/shop-slug.decorator';

@Controller('public')
export class PublicController {
  constructor(private readonly publicSvc: PublicService) {}

  @Public() @Get('site-config')
  siteConfig(@ShopSlug() slug: string) {
    return this.publicSvc.siteConfig(slug);
  }

  @Public() @Get('landing-images')
  landingImages(@ShopSlug() slug: string) {
    return this.publicSvc.landingImages(slug);
  }
}
