import { Module } from '@nestjs/common';

import { CorporateEventController } from '@api/investment/v1/corporate-event.controller';
import { CorporateEventService } from '@api/investment/v1/corporate-event.service';
import { FixedIncomeController } from '@api/investment/v1/fixed-income.controller';
import { FixedIncomeService } from '@api/investment/v1/fixed-income.service';
import { IncomeController } from '@api/investment/v1/income.controller';
import { IncomeService } from '@api/investment/v1/income.service';
import { InvestmentController } from '@api/investment/v1/investment.controller';
import { InvestmentService } from '@api/investment/v1/investment.service';
import { RefreshIncomeEventsJob } from '@api/investment/v1/job/RefreshIncomeEventsJob';
import { RefreshQuotesJob } from '@api/investment/v1/job/RefreshQuotesJob';
import { FamilyModule } from '@family/family.module';
import { InvestmentModule } from '@investment/investment.module';

@Module({
  controllers: [
    InvestmentController,
    FixedIncomeController,
    IncomeController,
    CorporateEventController,
  ],
  imports: [FamilyModule, InvestmentModule],
  providers: [
    CorporateEventService,
    FixedIncomeService,
    IncomeService,
    InvestmentService,
    RefreshIncomeEventsJob,
    RefreshQuotesJob,
  ],
})
export class InvestmentAPIModule {}
