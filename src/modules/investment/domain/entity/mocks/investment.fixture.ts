import { faker } from '@faker-js/faker';

import { AssetDetail, AssetEntity, AssetListRow } from '@investment/domain/entity/AssetEntity';
import { ConversionDetail } from '@investment/domain/entity/ConversionEntity';
import {
  FixedIncomeData,
  FixedIncomeRateEntity,
  FixedIncomeTermsEntity,
} from '@investment/domain/entity/FixedIncomeEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { QuoteEntity } from '@investment/domain/entity/QuoteEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
  InvestmentOperationType,
  InvestmentValuationSource,
} from '@investment/domain/enum';
import { QuoteMarket, QuoteSource } from '@investment/domain/enum/QuoteMarket';
import {
  IInvestmentRepository,
  IMarketIndexRepository,
  IQuoteRepository,
} from '@investment/domain/repository';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

export function assetFixture(overrides: Partial<AssetEntity> = {}): AssetEntity {
  return {
    archivedAt: null,
    assetClass: InvestmentAssetClass.BR_STOCK,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    currency: 'BRL',
    id: faker.string.uuid(),
    name: 'Itausa PN',
    owner: OwnerType.USER,
    ownerId: faker.string.uuid(),
    status: InvestmentAssetStatus.ACTIVE,
    ticker: 'ITSA4',
    ...overrides,
  };
}
export function conversionFixture(overrides: Partial<ConversionDetail> = {}): ConversionDetail {
  return {
    cashAmount: null,
    cashReferenceUnitValue: null,
    date: '2026-10-15',
    fromAssetId: faker.string.uuid(),
    fromTicker: 'BCFF11',
    id: faker.string.uuid(),
    locked: false,
    ratioFrom: Decimal8.parse('1'),
    ratioTo: Decimal8.parse('7.4'),
    toAssetId: faker.string.uuid(),
    toTicker: 'BTHF11',
    ...overrides,
  };
}
export function listRowFixture(overrides: Partial<AssetListRow> = {}): AssetListRow {
  return { ...assetFixture(), latestValuation: null, operations: [], ...overrides };
}
export function operationFixture(overrides: Partial<OperationEntity> = {}): OperationEntity {
  return {
    accountId: null,
    assetId: faker.string.uuid(),
    cashCost: null,
    conversionCost: null,
    conversionId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    date: '2026-06-10',
    event: null,
    eventSuggestionId: null,
    fees: [],
    feesTotal: 0,
    fractionCost: null,
    fractionOfOperationId: null,
    fractionQuantity: null,
    fxRate: null,
    generateTransaction: false,
    gross: 510000,
    id: faker.string.uuid(),
    netAmount: null,
    quantity: Decimal8.parse('500'),
    redemptionKind: null,
    total: 510000,
    transactionId: null,
    type: InvestmentOperationType.BUY,
    unitPrice: Decimal8.parse('10.20'),
    ...overrides,
  };
}

// Every repository method as a jest spy, for the use case tests.
export function quoteFixture(overrides: Partial<QuoteEntity> = {}): QuoteEntity {
  return {
    changePercent: '0.4800',
    currency: 'BRL',
    dayHigh: Decimal8.parse('10.6'),
    dayLow: Decimal8.parse('10.4'),
    fetchedAt: new Date('2026-11-04T16:05:00Z'),
    lastErrorAt: null,
    logoUrl: null,
    market: QuoteMarket.B3,
    missingDays: 0,
    name: 'Itausa PN',
    previousClose: Decimal8.parse('10.48'),
    price: Decimal8.parse('10.53'),
    quotedAt: new Date('2026-11-04T16:00:00Z'),
    source: QuoteSource.BRAPI,
    ticker: 'ITSA4',
    unavailable: false,
    ...overrides,
  };
}
export function repositorySpies(): Record<keyof IInvestmentRepository, jest.Mock> {
  return {
    createAsset: jest.fn(),
    createFixedIncomeRate: jest.fn(),
    createFixedIncomeTitle: jest.fn(),
    deleteAsset: jest.fn(),
    deleteAssetsByOwner: jest.fn(),
    deleteConversion: jest.fn(),
    deleteFixedIncomeAdjustment: jest.fn(),
    deleteFixedIncomeRate: jest.fn(),
    deleteOperation: jest.fn(),
    deleteValuation: jest.fn(),
    existsByOwner: jest.fn(),
    findAccountForOperation: jest.fn(),
    findAssetById: jest.fn(),
    findAssetByTicker: jest.fn(),
    findAssetsByOwners: jest.fn(),
    findConversionById: jest.fn(),
    findConversionsByAssetIds: jest.fn(),
    findFixedIncomeAdjustmentById: jest.fn(),
    findFixedIncomeByAssetIds: jest.fn(),
    findFixedIncomeRateById: jest.fn(),
    findOperationById: jest.fn(),
    findOperationByTransactionId: jest.fn(),
    findValuationById: jest.fn(),
    findValuationsByAssets: jest.fn(),
    saveFixedIncomeTerms: jest.fn(),
    updateAsset: jest.fn(),
    updateFixedIncomeRate: jest.fn(),
    upsertFixedIncomeAdjustment: jest.fn(),
    upsertValuation: jest.fn(),
    writeConversion: jest.fn(),
    writeEvent: jest.fn(),
    writeOperation: jest.fn(),
  };
}
export function valuationFixture(overrides: Partial<ValuationEntity> = {}): ValuationEntity {
  return {
    assetId: faker.string.uuid(),
    date: '2026-11-01',
    id: faker.string.uuid(),
    source: InvestmentValuationSource.MANUAL,
    unitPrice: Decimal8.parse('10.53'),
    ...overrides,
  };
}
// Every quote repository method as a jest spy.
export function marketIndexRepositorySpies(): Record<keyof IMarketIndexRepository, jest.Mock> {
  return {
    findFetches: jest.fn(),
    findFollowers: jest.fn(),
    findFxPairs: jest.fn(),
    findHistory: jest.fn(),
    findLatest: jest.fn(),
    findLatestDates: jest.fn(),
    findSeriesData: jest.fn(),
    recalculateIndexedTitles: jest.fn(),
    recordFetch: jest.fn(),
    upsertValues: jest.fn(),
    versionStamp: jest.fn(),
  };
}
export function quoteRepositorySpies(): Record<keyof IQuoteRepository, jest.Mock> {
  return {
    findFx: jest.fn(),
    findFxHistory: jest.fn(),
    findFxOnOrBefore: jest.fn(),
    findHistory: jest.fn(),
    findHistoryBatch: jest.fn(),
    findQuotes: jest.fn(),
    findTrackedSymbols: jest.fn(),
    hasHistory: jest.fn(),
    markMissing: jest.fn(),
    markQuoteErrors: jest.fn(),
    runExclusive: jest.fn(),
    saveFx: jest.fn(),
    saveFxHistory: jest.fn(),
    saveHistory: jest.fn(),
    saveQuotes: jest.fn(),
  };
}

// Spec 105: a calculated CDB of R$ 10.000 applied on 2026-01-02 at 12% a.a. prefixed, maturing in 2030.
export function fixedIncomeDataFixture(
  overrides: Partial<FixedIncomeData> = {},
): { terms: FixedIncomeTermsEntity } & FixedIncomeData {
  return {
    adjustments: [],
    rates: [fixedIncomeRateFixture()],
    terms: fixedIncomeTermsFixture(),
    ...overrides,
  } as { terms: FixedIncomeTermsEntity } & FixedIncomeData;
}
export function fixedIncomeDetailFixture(overrides: Partial<AssetDetail> = {}): AssetDetail {
  const asset = assetFixture({
    assetClass: InvestmentAssetClass.FIXED_INCOME,
    id: 'asset-fi',
    ownerId: 'user-1',
    ticker: null,
  });
  const lot = operationFixture({
    assetId: asset.id,
    date: '2026-01-02',
    gross: 1_000_000,
    id: 'lot-1',
    quantity: Decimal8.parse('10000'),
    total: 1_000_000,
    unitPrice: Decimal8.parse('1'),
  });

  return { ...asset, operations: [lot], valuations: [], ...overrides };
}
export function fixedIncomeRateFixture(
  overrides: Partial<FixedIncomeRateEntity> = {},
): FixedIncomeRateEntity {
  return {
    annualRate: '12.0000',
    assetId: 'asset-fi',
    cdiPercent: null,
    effectiveRate: '12.000000',
    id: faker.string.uuid(),
    indexRate: null,
    mode: InvestmentFixedIncomeRateMode.PREFIXED,
    spread: null,
    startDate: '2026-01-02',
    ...overrides,
  };
}
export function fixedIncomeTermsFixture(
  overrides: Partial<FixedIncomeTermsEntity> = {},
): FixedIncomeTermsEntity {
  return {
    assetId: 'asset-fi',
    liquidity: InvestmentFixedIncomeLiquidity.DAILY,
    liquidityDate: null,
    maturityDate: '2030-01-02',
    product: InvestmentFixedIncomeProduct.CDB,
    taxExempt: false,
    ...overrides,
  };
}

// Spec 112: BCFF11 (103 quotas, cost 808550) converted into BTHF11 at 1 for 7.4 (762 quotas + a 0.2 fraction).
export function conversionScenario(): {
  conversion: ConversionDetail;
  destination: AssetDetail;
  origin: AssetDetail;
} {
  const origin = assetFixture({
    archivedAt: new Date('2026-10-16T00:00:00Z'),
    assetClass: InvestmentAssetClass.BR_REIT,
    ownerId: 'user-1',
    status: InvestmentAssetStatus.ARCHIVED,
    ticker: 'BCFF11',
  });
  const destination = assetFixture({
    assetClass: InvestmentAssetClass.BR_REIT,
    ownerId: 'user-1',
    ticker: 'BTHF11',
  });
  const conversion = conversionFixture({
    fromAssetId: origin.id,
    id: 'conv-1',
    toAssetId: destination.id,
  });

  return {
    conversion,
    destination: {
      ...destination,
      operations: [
        operationFixture({
          assetId: destination.id,
          conversionCost: 808550,
          conversionId: conversion.id,
          date: '2026-10-15',
          fractionCost: 212,
          fractionQuantity: Decimal8.parse('0.2'),
          generateTransaction: false,
          id: 'in-1',
          quantity: Decimal8.parse('762'),
          total: 0,
          type: InvestmentOperationType.CONVERSION_IN,
        }),
      ],
      valuations: [],
    },
    origin: {
      ...origin,
      operations: [
        operationFixture({
          assetId: origin.id,
          conversionCost: 808550,
          conversionId: conversion.id,
          date: '2026-10-15',
          generateTransaction: false,
          id: 'out-1',
          quantity: Decimal8.parse('103'),
          total: 0,
          type: InvestmentOperationType.CONVERSION_OUT,
        }),
        operationFixture({
          assetId: origin.id,
          date: '2026-06-10',
          id: 'buy-1',
          quantity: Decimal8.parse('103'),
          total: 808550,
        }),
      ],
      valuations: [],
    },
  };
}
