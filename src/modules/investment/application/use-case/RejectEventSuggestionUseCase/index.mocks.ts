import { Test } from '@nestjs/testing';

import {
  corporateEventRepositorySpies,
  eventSuggestionFixture,
} from '@investment/domain/entity/mocks/corporateEvent.fixture';
import { assetFixture, repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { RejectEventSuggestionUseCase } from './index';

export const spies = {
  events: corporateEventRepositorySpies(),
  investment: repositorySpies(),
};

const asset = assetFixture({ ownerId: 'user-1' });

export const mocks = {
  asset,
  detail: { ...asset, operations: [], valuations: [] },
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  suggestion: eventSuggestionFixture({ assetId: asset.id, id: 'sug-1' }),
};

export let setup: RejectEventSuggestionUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      RejectEventSuggestionUseCase,
      { provide: 'IInvestmentRepository', useValue: spies.investment },
      { provide: 'ICorporateEventRepository', useValue: spies.events },
    ],
  }).compile();

  setup = module.get(RejectEventSuggestionUseCase);
});
