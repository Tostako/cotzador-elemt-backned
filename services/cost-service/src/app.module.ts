import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { Project } from './entities/project.entity';
import { Chapter } from './entities/chapter.entity';
import { Supply } from './entities/supply.entity';
import { SupplyPrice } from './entities/supply-price.entity';
import { Apu } from './entities/apu.entity';
import { ApuComponent } from './entities/apu-component.entity';
import { BudgetItem } from './entities/budget-item.entity';
import { BudgetEvent } from './entities/budget-event.entity';
import { Document } from './entities/document.entity';
import { Quotation } from './entities/quotation.entity';
import { QuotationLine } from './entities/quotation-line.entity';
import { AiApuProposal } from './entities/ai-apu-proposal.entity';
import { OrgBranding } from './entities/org-branding.entity';
import { Template } from './entities/template.entity';
import { ProjectsModule } from './projects/projects.module';
import { CatalogModule } from './catalog/catalog.module';
import { SuppliesModule } from './supplies/supplies.module';
import { BudgetModule } from './budget/budget.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DocumentsModule } from './documents/documents.module';
import { CostEngineModule } from './cost-engine/cost-engine.module';
import { TemplatesModule } from './templates/templates.module';
import { AiModule } from './ai/ai.module';
import { QuotationsModule } from './quotations/quotations.module';
import { BrandingModule } from './branding/branding.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('COST_DATABASE_URL') || config.get<string>('SUPABASE_DATABASE_URL'),
        schema: config.get<string>('COST_DATABASE_SCHEMA') || 'cost_pro',
        entities: [Project, Chapter, Supply, SupplyPrice, Apu, ApuComponent, BudgetItem, BudgetEvent, Document, Quotation, QuotationLine, AiApuProposal, OrgBranding, Template],
        synchronize: false,
        retryAttempts: 3,
        retryDelay: 3000,
        extra: {
          max: 3,
          min: 1,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000,
        },
      }),
      inject: [ConfigService],
    }),
    CostEngineModule,
    ProjectsModule,
    CatalogModule,
    SuppliesModule,
    BudgetModule,
    AnalyticsModule,
    DocumentsModule,
    TemplatesModule,
    AiModule,
    QuotationsModule,
    BrandingModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}