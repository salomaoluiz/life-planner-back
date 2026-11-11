import { Test } from '@nestjs/testing';

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
import { InvestmentCorporateEventType } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

import { GetEventSuggestionsUseCase } from './index';

export const spies = {
  events: corporateEventRepositorySpies(),
  investment: repositorySpies(),
};

const asset = assetFixture({ ownerId: 'user-1', ticker: 'MGLU3' });
const bought = operationFixture({
  assetId: asset.id,
  date: '2026-01-10',
  quantity: Decimal8.parse('3155'),
  total: 319100,
});
const reverse = corporateEventFixture();
const bonus = corporateEventFixture({
  bonusPercent: '10',
  bonusUnitCost: '4.5',
  id: 'bonus-event',
  ratioFrom: null,
  ratioTo: null,
  recordDate: '2026-11-18',
  type: InvestmentCorporateEventType.BONUS,
});

export const mocks = {
  asset,
  bonus,
  bonusSuggestion: eventSuggestionFixture({
    assetId: asset.id,
    event: bonus,
    id: 'sug-bonus',
    quantity: '315',
  }),
  bought,
  detail: { ...asset, operations: [bought], valuations: [] },
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  reverse,
  reverseSuggestion: eventSuggestionFixture({
    assetId: asset.id,
    event: reverse,
    id: 'sug-reverse',
  }),
};

export let setup: GetEventSuggestionsUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetEventSuggestionsUseCase,
      { provide: 'IInvestmentRepository', useValue: spies.investment },
      { provide: 'ICorporateEventRepository', useValue: spies.events },
    ],
  }).compile();

  setup = module.get(GetEventSuggestionsUseCase);
});
