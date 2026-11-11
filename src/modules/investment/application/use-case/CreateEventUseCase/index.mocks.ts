import { Test } from '@nestjs/testing';

import { quoteProviders } from '@investment/application/service/QuoteContext/index.mocks';
import {
  assetFixture,
  operationFixture,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentOperationType } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

import { CreateEventUseCase } from './index';

export const spies = repositorySpies();

const asset = assetFixture({ ownerId: 'user-1', ticker: 'MGLU3' });
const bought = operationFixture({
  assetId: asset.id,
  date: '2026-01-10',
  quantity: Decimal8.parse('3155'),
  total: 319100,
});
const event = operationFixture({
  assetId: asset.id,
  date: '2026-03-10',
  event: { kind: 'SPLIT', ratioFrom: Decimal8.parse('10'), ratioTo: Decimal8.parse('1') },
  id: 'event-1',
  quantity: Decimal8.zero(),
  total: 0,
  type: InvestmentOperationType.REVERSE_SPLIT,
  unitPrice: Decimal8.zero(),
});

export const mocks = {
  asset,
  detail: { ...asset, operations: [bought, event], valuations: [] },
  event,
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
};

export let setup: CreateEventUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CreateEventUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      ...quoteProviders,
    ],
  }).compile();

  setup = module.get(CreateEventUseCase);
});
