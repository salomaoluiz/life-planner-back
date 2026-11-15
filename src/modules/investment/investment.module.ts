import { Module } from '@nestjs/common';

import { HistoryBackfill } from '@investment/application/service/HistoryBackfill';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import { TickerValidator } from '@investment/application/service/TickerValidator';
import { ApproveEventSuggestionUseCase } from '@investment/application/use-case/ApproveEventSuggestionUseCase';
import { ApproveIncomeSuggestionUseCase } from '@investment/application/use-case/ApproveIncomeSuggestionUseCase';
import { CreateAssetUseCase } from '@investment/application/use-case/CreateAssetUseCase';
import { CreateEventUseCase } from '@investment/application/use-case/CreateEventUseCase';
import { CreateFixedIncomeContributionUseCase } from '@investment/application/use-case/CreateFixedIncomeContributionUseCase';
import { CreateFixedIncomeRateUseCase } from '@investment/application/use-case/CreateFixedIncomeRateUseCase';
import { CreateFixedIncomeRedemptionUseCase } from '@investment/application/use-case/CreateFixedIncomeRedemptionUseCase';
import { CreateFixedIncomeTitleUseCase } from '@investment/application/use-case/CreateFixedIncomeTitleUseCase';
import { CreateFractionSaleUseCase } from '@investment/application/use-case/CreateFractionSaleUseCase';
import { CreateIncomeUseCase } from '@investment/application/use-case/CreateIncomeUseCase';
import { CreateOperationUseCase } from '@investment/application/use-case/CreateOperationUseCase';
import { DeleteAssetUseCase } from '@investment/application/use-case/DeleteAssetUseCase';
import { DeleteFixedIncomeAdjustmentUseCase } from '@investment/application/use-case/DeleteFixedIncomeAdjustmentUseCase';
import { DeleteFixedIncomeRateUseCase } from '@investment/application/use-case/DeleteFixedIncomeRateUseCase';
import { DeleteIncomeUseCase } from '@investment/application/use-case/DeleteIncomeUseCase';
import { DeleteInvestmentsByOwnerUseCase } from '@investment/application/use-case/DeleteInvestmentsByOwnerUseCase';
import { DeleteOperationUseCase } from '@investment/application/use-case/DeleteOperationUseCase';
import { DeleteValuationUseCase } from '@investment/application/use-case/DeleteValuationUseCase';
import { FindIncomeByTransactionIdUseCase } from '@investment/application/use-case/FindIncomeByTransactionIdUseCase';
import { FindOperationByTransactionIdUseCase } from '@investment/application/use-case/FindOperationByTransactionIdUseCase';
import { GetAssetByIdUseCase } from '@investment/application/use-case/GetAssetByIdUseCase';
import { GetAssetsUseCase } from '@investment/application/use-case/GetAssetsUseCase';
import { GetEventSuggestionsUseCase } from '@investment/application/use-case/GetEventSuggestionsUseCase';
import { GetIncomeByIdUseCase } from '@investment/application/use-case/GetIncomeByIdUseCase';
import { GetIncomeDefaultsUseCase } from '@investment/application/use-case/GetIncomeDefaultsUseCase';
import { GetIncomeSuggestionsUseCase } from '@investment/application/use-case/GetIncomeSuggestionsUseCase';
import { GetIncomesUseCase } from '@investment/application/use-case/GetIncomesUseCase';
import { GetInvestmentsHomeSummaryUseCase } from '@investment/application/use-case/GetInvestmentsHomeSummaryUseCase';
import { GetPriceHistoryUseCase } from '@investment/application/use-case/GetPriceHistoryUseCase';
import { HasInvestmentsByOwnerUseCase } from '@investment/application/use-case/HasInvestmentsByOwnerUseCase';
import { PreviewFixedIncomeRedemptionUseCase } from '@investment/application/use-case/PreviewFixedIncomeRedemptionUseCase';
import { ReceiveIncomeUseCase } from '@investment/application/use-case/ReceiveIncomeUseCase';
import { RefreshCorporateEventsUseCase } from '@investment/application/use-case/RefreshCorporateEventsUseCase';
import { RefreshIncomeEventsUseCase } from '@investment/application/use-case/RefreshIncomeEventsUseCase';
import { RefreshQuotesNowUseCase } from '@investment/application/use-case/RefreshQuotesNowUseCase';
import { RefreshTrackedQuotesUseCase } from '@investment/application/use-case/RefreshTrackedQuotesUseCase';
import { RejectEventSuggestionUseCase } from '@investment/application/use-case/RejectEventSuggestionUseCase';
import { RejectIncomeSuggestionUseCase } from '@investment/application/use-case/RejectIncomeSuggestionUseCase';
import { SearchTickersUseCase } from '@investment/application/use-case/SearchTickersUseCase';
import { SimulateFixedIncomeUseCase } from '@investment/application/use-case/SimulateFixedIncomeUseCase';
import { UpdateAssetUseCase } from '@investment/application/use-case/UpdateAssetUseCase';
import { UpdateFixedIncomeRateUseCase } from '@investment/application/use-case/UpdateFixedIncomeRateUseCase';
import { UpdateIncomeUseCase } from '@investment/application/use-case/UpdateIncomeUseCase';
import { UpdateOperationUseCase } from '@investment/application/use-case/UpdateOperationUseCase';
import { UpsertFixedIncomeAdjustmentUseCase } from '@investment/application/use-case/UpsertFixedIncomeAdjustmentUseCase';
import { UpsertFixedIncomeTermsUseCase } from '@investment/application/use-case/UpsertFixedIncomeTermsUseCase';
import { UpsertValuationUseCase } from '@investment/application/use-case/UpsertValuationUseCase';
import { CorporateEventDatasource } from '@investment/data/datasource/CorporateEventDatasource';
import { IncomeDatasource } from '@investment/data/datasource/IncomeDatasource';
import { InvestmentDatasource } from '@investment/data/datasource/InvestmentDatasource';
import { QuoteDatasource } from '@investment/data/datasource/QuoteDatasource';
import { CorporateEventRepository } from '@investment/data/repository/CorporateEventRepository';
import { IncomeRepository } from '@investment/data/repository/IncomeRepository';
import { InvestmentRepository } from '@investment/data/repository/InvestmentRepository';
import { QuoteRepository } from '@investment/data/repository/QuoteRepository';

const services = [HistoryBackfill, QuoteContextLoader, QuoteFetcher, TickerValidator];
const useCases = [
  ApproveEventSuggestionUseCase,
  ApproveIncomeSuggestionUseCase,
  CreateEventUseCase,
  CreateFractionSaleUseCase,
  CreateIncomeUseCase,
  DeleteIncomeUseCase,
  FindIncomeByTransactionIdUseCase,
  GetEventSuggestionsUseCase,
  GetIncomeByIdUseCase,
  GetIncomeDefaultsUseCase,
  GetIncomeSuggestionsUseCase,
  GetIncomesUseCase,
  GetInvestmentsHomeSummaryUseCase,
  ReceiveIncomeUseCase,
  RefreshCorporateEventsUseCase,
  RefreshIncomeEventsUseCase,
  RejectEventSuggestionUseCase,
  RejectIncomeSuggestionUseCase,
  UpdateIncomeUseCase,
  PreviewFixedIncomeRedemptionUseCase,
  SimulateFixedIncomeUseCase,
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
    { provide: 'ICorporateEventRepository', useClass: CorporateEventRepository },
    { provide: 'ICorporateEventDatasource', useClass: CorporateEventDatasource },
    { provide: 'IIncomeRepository', useClass: IncomeRepository },
    { provide: 'IIncomeDatasource', useClass: IncomeDatasource },
    { provide: 'IQuoteRepository', useClass: QuoteRepository },
    { provide: 'IQuoteDatasource', useClass: QuoteDatasource },
  ],
})
export class InvestmentModule {}
