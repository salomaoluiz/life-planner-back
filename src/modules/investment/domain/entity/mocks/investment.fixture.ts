import { faker } from '@faker-js/faker';

import { AssetEntity, AssetListRow } from '@investment/domain/entity/AssetEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { QuoteEntity } from '@investment/domain/entity/QuoteEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentOperationType,
  InvestmentValuationSource,
} from '@investment/domain/enum';
import { QuoteMarket, QuoteSource } from '@investment/domain/enum/QuoteMarket';
import { IInvestmentRepository, IQuoteRepository } from '@investment/domain/repository';
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
export function listRowFixture(overrides: Partial<AssetListRow> = {}): AssetListRow {
  return { ...assetFixture(), latestValuation: null, operations: [], ...overrides };
}
export function operationFixture(overrides: Partial<OperationEntity> = {}): OperationEntity {
  return {
    accountId: null,
    assetId: faker.string.uuid(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    date: '2026-06-10',
    fees: [],
    feesTotal: 0,
    fxRate: null,
    generateTransaction: false,
    gross: 510000,
    id: faker.string.uuid(),
    quantity: Decimal8.parse('500'),
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
    deleteAsset: jest.fn(),
    deleteAssetsByOwner: jest.fn(),
    deleteOperation: jest.fn(),
    deleteValuation: jest.fn(),
    existsByOwner: jest.fn(),
    findAccountForOperation: jest.fn(),
    findAssetById: jest.fn(),
    findAssetByTicker: jest.fn(),
    findAssetsByOwners: jest.fn(),
    findOperationById: jest.fn(),
    findOperationByTransactionId: jest.fn(),
    findValuationById: jest.fn(),
    updateAsset: jest.fn(),
    upsertValuation: jest.fn(),
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
export function quoteRepositorySpies(): Record<keyof IQuoteRepository, jest.Mock> {
  return {
    findFx: jest.fn(),
    findFxHistory: jest.fn(),
    findFxOnOrBefore: jest.fn(),
    findHistory: jest.fn(),
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
