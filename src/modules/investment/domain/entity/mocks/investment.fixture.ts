import { faker } from '@faker-js/faker';

import { AssetEntity, AssetListRow } from '@investment/domain/entity/AssetEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentOperationType,
  InvestmentValuationSource,
} from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
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
