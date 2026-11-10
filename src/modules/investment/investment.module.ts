import { Module } from '@nestjs/common';

import { HistoryBackfill } from '@investment/application/service/HistoryBackfill';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import { TickerValidator } from '@investment/application/service/TickerValidator';
import { CreateAssetUseCase } from '@investment/application/use-case/CreateAssetUseCase';
import { CreateFixedIncomeContributionUseCase } from '@investment/application/use-case/CreateFixedIncomeContributionUseCase';
import { CreateFixedIncomeRateUseCase } from '@investment/application/use-case/CreateFixedIncomeRateUseCase';
import { CreateFixedIncomeRedemptionUseCase } from '@investment/application/use-case/CreateFixedIncomeRedemptionUseCase';
import { CreateFixedIncomeTitleUseCase } from '@investment/application/use-case/CreateFixedIncomeTitleUseCase';
import { CreateOperationUseCase } from '@investment/application/use-case/CreateOperationUseCase';
import { DeleteAssetUseCase } from '@investment/application/use-case/DeleteAssetUseCase';
import { DeleteFixedIncomeAdjustmentUseCase } from '@investment/application/use-case/DeleteFixedIncomeAdjustmentUseCase';
import { DeleteFixedIncomeRateUseCase } from '@investment/application/use-case/DeleteFixedIncomeRateUseCase';
import { DeleteInvestmentsByOwnerUseCase } from '@investment/application/use-case/DeleteInvestmentsByOwnerUseCase';
import { DeleteOperationUseCase } from '@investment/application/use-case/DeleteOperationUseCase';
import { DeleteValuationUseCase } from '@investment/application/use-case/DeleteValuationUseCase';
import { FindOperationByTransactionIdUseCase } from '@investment/application/use-case/FindOperationByTransactionIdUseCase';
import { GetAssetByIdUseCase } from '@investment/application/use-case/GetAssetByIdUseCase';
import { GetAssetsUseCase } from '@investment/application/use-case/GetAssetsUseCase';
import { GetPriceHistoryUseCase } from '@investment/application/use-case/GetPriceHistoryUseCase';
import { HasInvestmentsByOwnerUseCase } from '@investment/application/use-case/HasInvestmentsByOwnerUseCase';
import { RefreshQuotesNowUseCase } from '@investment/application/use-case/RefreshQuotesNowUseCase';
import { RefreshTrackedQuotesUseCase } from '@investment/application/use-case/RefreshTrackedQuotesUseCase';
import { SearchTickersUseCase } from '@investment/application/use-case/SearchTickersUseCase';
import { UpdateAssetUseCase } from '@investment/application/use-case/UpdateAssetUseCase';
import { UpdateFixedIncomeRateUseCase } from '@investment/application/use-case/UpdateFixedIncomeRateUseCase';
import { UpdateOperationUseCase } from '@investment/application/use-case/UpdateOperationUseCase';
import { UpsertFixedIncomeAdjustmentUseCase } from '@investment/application/use-case/UpsertFixedIncomeAdjustmentUseCase';
import { UpsertFixedIncomeTermsUseCase } from '@investment/application/use-case/UpsertFixedIncomeTermsUseCase';
import { UpsertValuationUseCase } from '@investment/application/use-case/UpsertValuationUseCase';
import { InvestmentDatasource } from '@investment/data/datasource/InvestmentDatasource';
import { QuoteDatasource } from '@investment/data/datasource/QuoteDatasource';
import { InvestmentRepository } from '@investment/data/repository/InvestmentRepository';
import { QuoteRepository } from '@investment/data/repository/QuoteRepository';

const services = [HistoryBackfill, QuoteContextLoader, QuoteFetcher, TickerValidator];
const useCases = [
  CreateFixedIncomeRedemptionUseCase,
  CreateFixedIncomeContributionUseCase,
  CreateFixedIncomeTitleUseCase,
  UpsertFixedIncomeTermsUseCase,
  CreateFixedIncomeRateUseCase,
  UpdateFixedIncomeRateUseCase,
  DeleteFixedIncomeRateUseCase,
  UpsertFixedIncomeAdjustmentUseCase,
  DeleteFixedIncomeAdjustmentUseCase,
  CreateAssetUseCase,
  CreateOperationUseCase,
  DeleteAssetUseCase,
  DeleteInvestmentsByOwnerUseCase,
  DeleteOperationUseCase,
  DeleteValuationUseCase,
  FindOperationByTransactionIdUseCase,
  GetAssetByIdUseCase,
  GetAssetsUseCase,
  GetPriceHistoryUseCase,
  HasInvestmentsByOwnerUseCase,
  RefreshQuotesNowUseCase,
  RefreshTrackedQuotesUseCase,
  SearchTickersUseCase,
  UpdateAssetUseCase,
  UpdateOperationUseCase,
  UpsertValuationUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...services,
    ...useCases,
    { provide: 'IInvestmentRepository', useClass: InvestmentRepository },
    { provide: 'IInvestmentDatasource', useClass: InvestmentDatasource },
    { provide: 'IQuoteRepository', useClass: QuoteRepository },
    { provide: 'IQuoteDatasource', useClass: QuoteDatasource },
  ],
})
export class InvestmentModule {}
