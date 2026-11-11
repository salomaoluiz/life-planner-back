import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';

import { InvestmentRepository } from './index';

const names = [
  'createFixedIncomeRate',
  'createFixedIncomeTitle',
  'deleteFixedIncomeAdjustment',
  'deleteFixedIncomeRate',
  'findFixedIncomeAdjustmentById',
  'findFixedIncomeByAssetIds',
  'findFixedIncomeRateById',
  'saveFixedIncomeTerms',
  'updateFixedIncomeRate',
  'upsertFixedIncomeAdjustment',
  'createAsset',
  'deleteAsset',
  'deleteAssetsByOwner',
  'deleteOperation',
  'deleteValuation',
  'existsByOwner',
  'findAccountById',
  'findAssetById',
  'findAssetByTicker',
  'findAssets',
  'findLatestValuations',
  'findOperationById',
  'findOperationByTransactionId',
  'findOperationsByAssetIds',
  'findValuationById',
  'findValuationsByAssetId',
  'updateAsset',
  'upsertValuation',
  'writeEvent',
  'writeOperation',
] as const;

export const spies = Object.fromEntries(names.map((name) => [name, jest.fn()])) as Record<
  (typeof names)[number],
  jest.Mock
>;

export const mocks = {
  asset: {
    archived_at: null,
    asset_class: 'BR_STOCK',
    created_at: new Date('2026-01-01T00:00:00Z'),
    currency: 'BRL',
    id: 'asset-1',
    name: 'Itausa',
    owner: 'USER',
    owner_id: 'owner-1',
    status: 'ACTIVE',
    ticker: 'ITSA4',
    updated_at: new Date('2026-01-01T00:00:00Z'),
  },
  operation: {
    account_id: null,
    asset_id: 'asset-1',
    created_at: new Date('2026-01-01T00:00:00Z'),
    date: new Date('2026-06-10T00:00:00Z'),
    fees: [],
    fees_total: 0,
    generate_transaction: false,
    gross: 100,
    id: 'op-1',
    net_amount: null,
    quantity: new Prisma.Decimal('10'),
    redemption_kind: null,
    total: 100,
    transaction_id: null,
    type: 'BUY',
    unit_price: new Prisma.Decimal('1'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  },
  valuation: {
    asset_id: 'asset-1',
    created_at: new Date(),
    date: new Date('2026-11-01T00:00:00Z'),
    id: 'val-1',
    source: 'MANUAL',
    unit_price: new Prisma.Decimal('10.53'),
    updated_at: new Date(),
  },
};

export let setup: InvestmentRepository;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [InvestmentRepository, { provide: 'IInvestmentDatasource', useValue: spies }],
  }).compile();

  setup = module.get(InvestmentRepository);
});
