import { Module } from '@nestjs/common';

import { ConversionController } from '@api/investment/v1/conversion.controller';
import { ConversionService } from '@api/investment/v1/conversion.service';
import { CorporateEventController } from '@api/investment/v1/corporate-event.controller';
import { CorporateEventService } from '@api/investment/v1/corporate-event.service';
import { FixedIncomeController } from '@api/investment/v1/fixed-income.controller';
import { FixedIncomeService } from '@api/investment/v1/fixed-income.service';
import { IncomeSeriesController } from '@api/investment/v1/income-series.controller';
import { IncomeSeriesService } from '@api/investment/v1/income-series.service';
import { IncomeController } from '@api/investment/v1/income.controller';
import { IncomeService } from '@api/investment/v1/income.service';
import { InvestmentController } from '@api/investment/v1/investment.controller';
import { InvestmentService } from '@api/investment/v1/investment.service';
import { RefreshIncomeEventsJob } from '@api/investment/v1/job/RefreshIncomeEventsJob';
import { RefreshIncomeSeriesJob } from '@api/investment/v1/job/RefreshIncomeSeriesJob';
import { RefreshMarketIndexesJob } from '@api/investment/v1/job/RefreshMarketIndexesJob';
import { RefreshQuotesJob } from '@api/investment/v1/job/RefreshQuotesJob';
import { MarketIndexController } from '@api/investment/v1/market-index.controller';
import { MarketIndexService } from '@api/investment/v1/market-index.service';
import { FamilyModule } from '@family/family.module';
import { InvestmentModule } from '@investment/investment.module';

@Module({
  controllers: [
    InvestmentController,
    FixedIncomeController,
    IncomeController,
    IncomeSeriesController,
    CorporateEventController,
    ConversionController,
    MarketIndexController,
  ],
  imports: [FamilyModule, InvestmentModule],
  providers: [
    ConversionService,
    CorporateEventService,
    FixedIncomeService,
    IncomeSeriesService,
    IncomeService,
    InvestmentService,
    MarketIndexService,
    RefreshIncomeEventsJob,
    RefreshIncomeSeriesJob,
    RefreshMarketIndexesJob,
    RefreshQuotesJob,
  ],
})
export class InvestmentAPIModule {}
