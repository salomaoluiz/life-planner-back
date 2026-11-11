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

import { CreateFractionSaleUseCase } from './index';

export const spies = repositorySpies();

const asset = assetFixture({ ownerId: 'user-1', ticker: 'MGLU3' });
const bought = operationFixture({
  assetId: asset.id,
  date: '2026-01-10',
  id: 'buy-1',
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
const sale = operationFixture({
  accountId: 'acc-1',
  assetId: asset.id,
  date: '2026-04-04',
  fractionOfOperationId: 'event-1',
  gross: 520,
  id: 'sale-1',
  quantity: Decimal8.parse('0.5'),
  total: 520,
  type: InvestmentOperationType.SELL,
  unitPrice: Decimal8.parse('10.4'),
});

export const mocks = {
  account: {
    archived: false,
    currency: 'BRL',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  },
  asset,
  bought,
  detail: { ...asset, operations: [bought, event], valuations: [] },
  event,
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  sale,
};

export let setup: CreateFractionSaleUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CreateFractionSaleUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      ...quoteProviders,
    ],
  }).compile();

  setup = module.get(CreateFractionSaleUseCase);
});
