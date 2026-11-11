import { Test } from '@nestjs/testing';

import { quoteProviders } from '@investment/application/service/QuoteContext/index.mocks';
import { corporateEventRepositorySpies } from '@investment/domain/entity/mocks/corporateEvent.fixture';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { GetAssetsUseCase } from './index';

export const spies = repositorySpies();
export const eventSpies = corporateEventRepositorySpies();

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export const mocks = {
  owners: [
    { owner: OwnerType.USER, ownerId: 'user-1' },
    { archived: true, owner: OwnerType.FAMILY, ownerId: 'fam-archived' },
    { owner: OwnerType.FAMILY, ownerId: 'fam' },
  ],
};

export let setup: GetAssetsUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  eventSpies.countPendingByAsset.mockResolvedValue(new Map());

  const module = await Test.createTestingModule({
    providers: [
      GetAssetsUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      { provide: 'ICorporateEventRepository', useValue: eventSpies },
      ...quoteProviders,
    ],
  }).compile();

  setup = module.get(GetAssetsUseCase);
});
