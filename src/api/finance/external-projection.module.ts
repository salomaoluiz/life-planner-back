import { Global, Module } from '@nestjs/common';

import { InvestmentProjectionSource } from '@api/finance/v1/investment-projection.source';
import { EXTERNAL_PROJECTION_SOURCE } from '@finance/domain/repository';
import { InvestmentModule } from '@investment/investment.module';

// Spec 115: binds finance's `IExternalProjectionSource` port to the investment income series. Global so the finance
// use cases (declared in `FinanceModule`) can inject it without importing the investment module: `src/api` aggregates.
@Global()
@Module({
  exports: [EXTERNAL_PROJECTION_SOURCE],
  imports: [InvestmentModule],
  providers: [{ provide: EXTERNAL_PROJECTION_SOURCE, useClass: InvestmentProjectionSource }],
})
export class ExternalProjectionModule {}
