import { Test } from '@nestjs/testing';

import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { GetAssetsUseCase } from './index';

export const spies = repositorySpies();

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

  const module = await Test.createTestingModule({
    providers: [GetAssetsUseCase, { provide: 'IInvestmentRepository', useValue: spies }],
  }).compile();

  setup = module.get(GetAssetsUseCase);
});
