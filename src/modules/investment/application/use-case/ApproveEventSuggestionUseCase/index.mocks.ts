import { Test } from '@nestjs/testing';

import { quoteProviders } from '@investment/application/service/QuoteContext/index.mocks';
import {
  corporateEventFixture,
  corporateEventRepositorySpies,
  eventSuggestionFixture,
} from '@investment/domain/entity/mocks/corporateEvent.fixture';
import {
  assetFixture,
  operationFixture,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentCorporateEventType, InvestmentOperationType } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

import { ApproveEventSuggestionUseCase } from './index';

export const spies = {
  events: corporateEventRepositorySpies(),
  investment: repositorySpies(),
};

const asset = assetFixture({ ownerId: 'user-1', ticker: 'MGLU3' });
const bought = operationFixture({
  assetId: asset.id,
  date: '2026-01-10',
  quantity: Decimal8.parse('315'),
  total: 318594,
});
const bonusEvent = corporateEventFixture({
  bonusPercent: '10',
  bonusUnitCost: '4.5',
  ratioFrom: null,
  ratioTo: null,
  recordDate: '2026-11-18',
  type: InvestmentCorporateEventType.BONUS,
});
const written = operationFixture({
  assetId: asset.id,
  date: '2026-11-18',
  event: { kind: 'BONUS', percent: Decimal8.parse('10'), unitCost: Decimal8.parse('4.5') },
  eventSuggestionId: 'sug-1',
  id: 'event-1',
  quantity: Decimal8.zero(),
  total: 0,
  type: InvestmentOperationType.BONUS,
  unitPrice: Decimal8.zero(),
});

export const mocks = {
  asset,
  bonusEvent,
  detail: { ...asset, operations: [bought, written], valuations: [] },
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  suggestion: eventSuggestionFixture({
    assetId: asset.id,
    event: bonusEvent,
    id: 'sug-1',
    quantity: '315',
  }),
};

export let setup: ApproveEventSuggestionUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      ApproveEventSuggestionUseCase,
      { provide: 'IInvestmentRepository', useValue: spies.investment },
      { provide: 'ICorporateEventRepository', useValue: spies.events },
      ...quoteProviders,
    ],
  }).compile();

  setup = module.get(ApproveEventSuggestionUseCase);
});
