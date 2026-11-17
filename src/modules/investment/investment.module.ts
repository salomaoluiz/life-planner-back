import { Module } from '@nestjs/common';

import { HistoryBackfill } from '@investment/application/service/HistoryBackfill';
import { IncomeSeriesGate } from '@investment/application/service/IncomeSeriesGate';
import { IndexSeriesLoader } from '@investment/application/service/IndexSeriesLoader';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import { TickerValidator } from '@investment/application/service/TickerValidator';
import { ApproveEventSuggestionUseCase } from '@investment/application/use-case/ApproveEventSuggestionUseCase';
import { ApproveIncomeSuggestionUseCase } from '@investment/application/use-case/ApproveIncomeSuggestionUseCase';
import { CreateAssetUseCase } from '@investment/application/use-case/CreateAssetUseCase';
import { CreateConversionUseCase } from '@investment/application/use-case/CreateConversionUseCase';
import { CreateEventUseCase } from '@investment/application/use-case/CreateEventUseCase';
import { CreateFixedIncomeContributionUseCase } from '@investment/application/use-case/CreateFixedIncomeContributionUseCase';
import { CreateFixedIncomeRateUseCase } from '@investment/application/use-case/CreateFixedIncomeRateUseCase';
import { CreateFixedIncomeRedemptionUseCase } from '@investment/application/use-case/CreateFixedIncomeRedemptionUseCase';
import { CreateFixedIncomeTitleUseCase } from '@investment/application/use-case/CreateFixedIncomeTitleUseCase';
import { CreateFractionSaleUseCase } from '@investment/application/use-case/CreateFractionSaleUseCase';
import { CreateIncomeSeriesUseCase } from '@investment/application/use-case/CreateIncomeSeriesUseCase';
import { CreateIncomeUseCase } from '@investment/application/use-case/CreateIncomeUseCase';
import { CreateOperationUseCase } from '@investment/application/use-case/CreateOperationUseCase';
import { DeleteAssetUseCase } from '@investment/application/use-case/DeleteAssetUseCase';
import { DeleteConversionUseCase } from '@investment/application/use-case/DeleteConversionUseCase';
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
import { GetConversionByIdUseCase } from '@investment/application/use-case/GetConversionByIdUseCase';
import { GetEventSuggestionsUseCase } from '@investment/application/use-case/GetEventSuggestionsUseCase';
import { GetIncomeByIdUseCase } from '@investment/application/use-case/GetIncomeByIdUseCase';
import { GetIncomeDefaultsUseCase } from '@investment/application/use-case/GetIncomeDefaultsUseCase';
import { GetIncomeSeriesByIdUseCase } from '@investment/application/use-case/GetIncomeSeriesByIdUseCase';
import { GetIncomeSeriesProjectionsUseCase } from '@investment/application/use-case/GetIncomeSeriesProjectionsUseCase';
import { GetIncomeSeriesUseCase } from '@investment/application/use-case/GetIncomeSeriesUseCase';
import { GetIncomeSuggestionsUseCase } from '@investment/application/use-case/GetIncomeSuggestionsUseCase';
import { GetIncomesUseCase } from '@investment/application/use-case/GetIncomesUseCase';
import { GetInvestmentsDashboardUseCase } from '@investment/application/use-case/GetInvestmentsDashboardUseCase';
import { GetInvestmentsHomeSummaryUseCase } from '@investment/application/use-case/GetInvestmentsHomeSummaryUseCase';
import { GetMarketIndexesUseCase } from '@investment/application/use-case/GetMarketIndexesUseCase';
import { GetMarketIndexHistoryUseCase } from '@investment/application/use-case/GetMarketIndexHistoryUseCase';
import { GetPriceHistoryUseCase } from '@investment/application/use-case/GetPriceHistoryUseCase';
import { HasInvestmentsByOwnerUseCase } from '@investment/application/use-case/HasInvestmentsByOwnerUseCase';
import { MaterializeIncomeSeriesUseCase } from '@investment/application/use-case/MaterializeIncomeSeriesUseCase';
import { PreviewFixedIncomeRedemptionUseCase } from '@investment/application/use-case/PreviewFixedIncomeRedemptionUseCase';
import { PreviewIncomeSeriesUseCase } from '@investment/application/use-case/PreviewIncomeSeriesUseCase';
import { ReceiveIncomeUseCase } from '@investment/application/use-case/ReceiveIncomeUseCase';
import { RefreshCorporateEventsUseCase } from '@investment/application/use-case/RefreshCorporateEventsUseCase';
import { RefreshIncomeEventsUseCase } from '@investment/application/use-case/RefreshIncomeEventsUseCase';
import { RefreshIncomeSeriesUseCase } from '@investment/application/use-case/RefreshIncomeSeriesUseCase';
import { RefreshMarketIndexesNowUseCase } from '@investment/application/use-case/RefreshMarketIndexesNowUseCase';
import { RefreshMarketIndexesUseCase } from '@investment/application/use-case/RefreshMarketIndexesUseCase';
import { RefreshQuotesNowUseCase } from '@investment/application/use-case/RefreshQuotesNowUseCase';
import { RefreshTrackedQuotesUseCase } from '@investment/application/use-case/RefreshTrackedQuotesUseCase';
import { RejectEventSuggestionUseCase } from '@investment/application/use-case/RejectEventSuggestionUseCase';
import { RejectIncomeSuggestionUseCase } from '@investment/application/use-case/RejectIncomeSuggestionUseCase';
import { SearchTickersUseCase } from '@investment/application/use-case/SearchTickersUseCase';
import { SimulateFixedIncomeUseCase } from '@investment/application/use-case/SimulateFixedIncomeUseCase';
import { UpdateAssetUseCase } from '@investment/application/use-case/UpdateAssetUseCase';
import { UpdateConversionUseCase } from '@investment/application/use-case/UpdateConversionUseCase';
import { UpdateFixedIncomeRateUseCase } from '@investment/application/use-case/UpdateFixedIncomeRateUseCase';
import { UpdateIncomeSeriesUseCase } from '@investment/application/use-case/UpdateIncomeSeriesUseCase';
import { UpdateIncomeUseCase } from '@investment/application/use-case/UpdateIncomeUseCase';
import { UpdateOperationUseCase } from '@investment/application/use-case/UpdateOperationUseCase';
import { UpsertFixedIncomeAdjustmentUseCase } from '@investment/application/use-case/UpsertFixedIncomeAdjustmentUseCase';
import { UpsertFixedIncomeTermsUseCase } from '@investment/application/use-case/UpsertFixedIncomeTermsUseCase';
import { UpsertValuationUseCase } from '@investment/application/use-case/UpsertValuationUseCase';
import { CorporateEventDatasource } from '@investment/data/datasource/CorporateEventDatasource';
import { IncomeDatasource } from '@investment/data/datasource/IncomeDatasource';
import { IncomeSeriesDatasource } from '@investment/data/datasource/IncomeSeriesDatasource';
import { InvestmentDatasource } from '@investment/data/datasource/InvestmentDatasource';
import { MarketIndexDatasource } from '@investment/data/datasource/MarketIndexDatasource';
import { QuoteDatasource } from '@investment/data/datasource/QuoteDatasource';
import { CorporateEventRepository } from '@investment/data/repository/CorporateEventRepository';
import { IncomeRepository } from '@investment/data/repository/IncomeRepository';
import { IncomeSeriesRepository } from '@investment/data/repository/IncomeSeriesRepository';
import { InvestmentRepository } from '@investment/data/repository/InvestmentRepository';
import { MarketIndexRepository } from '@investment/data/repository/MarketIndexRepository';
import { QuoteRepository } from '@investment/data/repository/QuoteRepository';

const services = [
  IncomeSeriesGate,
  HistoryBackfill,
  IndexSeriesLoader,
  QuoteContextLoader,
  QuoteFetcher,
  TickerValidator,
];
const useCases = [
  CreateIncomeSeriesUseCase,
  GetIncomeSeriesByIdUseCase,
  GetIncomeSeriesProjectionsUseCase,
  GetIncomeSeriesUseCase,
  MaterializeIncomeSeriesUseCase,
  PreviewIncomeSeriesUseCase,
  RefreshIncomeSeriesUseCase,
  UpdateIncomeSeriesUseCase,
  ApproveEventSuggestionUseCase,
  ApproveIncomeSuggestionUseCase,
  CreateConversionUseCase,
  CreateEventUseCase,
  CreateFractionSaleUseCase,
  DeleteConversionUseCase,
  GetConversionByIdUseCase,
  UpdateConversionUseCase,
  CreateIncomeUseCase,
  DeleteIncomeUseCase,
  FindIncomeByTransactionIdUseCase,
  GetEventSuggestionsUseCase,
  GetIncomeByIdUseCase,
  GetIncomeDefaultsUseCase,
  GetIncomeSuggestionsUseCase,
  GetIncomesUseCase,
  GetInvestmentsDashboardUseCase,
  GetInvestmentsHomeSummaryUseCase,
  GetMarketIndexesUseCase,
  GetMarketIndexHistoryUseCase,
  ReceiveIncomeUseCase,
  RefreshCorporateEventsUseCase,
  RefreshIncomeEventsUseCase,
  RefreshMarketIndexesNowUseCase,
  RefreshMarketIndexesUseCase,
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
    { provide: 'IIncomeSeriesRepository', useClass: IncomeSeriesRepository },
    { provide: 'IIncomeSeriesDatasource', useClass: IncomeSeriesDatasource },
    { provide: 'IMarketIndexRepository', useClass: MarketIndexRepository },
    { provide: 'IMarketIndexDatasource', useClass: MarketIndexDatasource },
    { provide: 'IQuoteRepository', useClass: QuoteRepository },
    { provide: 'IQuoteDatasource', useClass: QuoteDatasource },
  ],
})
export class InvestmentModule {}
