import { Test } from '@nestjs/testing';

import {
  assetFixture,
  operationFixture,
  quoteRepositorySpies,
  repositorySpies,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

import { GetPriceHistoryUseCase } from './index';

export const spies = { investments: repositorySpies(), quotes: quoteRepositorySpies() };

const usAsset = assetFixture({
  assetClass: 'FOREIGN_STOCK' as never,
  currency: 'USD',
  owner: OwnerType.USER,
  ownerId: 'user-1',
  ticker: 'AAPL',
});

export const mocks = {
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  usDetail: {
    ...usAsset,
    operations: [
      operationFixture({
        assetId: usAsset.id,
        date: '2025-11-04',
        unitPrice: Decimal8.parse('182.10'),
      }),
    ],
    valuations: [
      valuationFixture({
        assetId: usAsset.id,
        date: '2025-12-01',
        unitPrice: Decimal8.parse('190'),
      }),
    ],
  },
};

export let setup: GetPriceHistoryUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetPriceHistoryUseCase,
      { provide: 'IInvestmentRepository', useValue: spies.investments },
      { provide: 'IQuoteRepository', useValue: spies.quotes },
    ],
  }).compile();

  setup = module.get(GetPriceHistoryUseCase);
});
