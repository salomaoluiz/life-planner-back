import { Module } from '@nestjs/common';

import { FixedIncomeController } from '@api/investment/v1/fixed-income.controller';
import { FixedIncomeService } from '@api/investment/v1/fixed-income.service';
import { InvestmentController } from '@api/investment/v1/investment.controller';
import { InvestmentService } from '@api/investment/v1/investment.service';
import { RefreshQuotesJob } from '@api/investment/v1/job/RefreshQuotesJob';
import { FamilyModule } from '@family/family.module';
import { InvestmentModule } from '@investment/investment.module';

@Module({
  controllers: [InvestmentController, FixedIncomeController],
  imports: [FamilyModule, InvestmentModule],
  providers: [FixedIncomeService, InvestmentService, RefreshQuotesJob],
})
export class InvestmentAPIModule {}
