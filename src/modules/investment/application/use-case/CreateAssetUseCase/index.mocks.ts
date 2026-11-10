import { Test } from '@nestjs/testing';

import { quoteProviders } from '@investment/application/service/QuoteContext/index.mocks';
import { assetFixture, repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { CreateAssetUseCase } from './index';

export const spies = repositorySpies();

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export const mocks = {
  asset: assetFixture(),
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
};

export let setup: CreateAssetUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CreateAssetUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      ...quoteProviders,
    ],
  }).compile();

  setup = module.get(CreateAssetUseCase);
});
