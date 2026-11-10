import { Test } from '@nestjs/testing';

import {
  assetFixture,
  operationFixture,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';

import { UpsertValuationUseCase } from './index';

export const spies = repositorySpies();

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const asset = assetFixture({ ownerId: 'user-1' });
const operation = operationFixture({ assetId: asset.id });
const owners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];

export const mocks = {
  account: {
    archived: false,
    currency: 'BRL',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  },
  asset,
  detail: { ...asset, operations: [operation], valuations: [] },
  operation,
  owners,
};

export let setup: UpsertValuationUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [UpsertValuationUseCase, { provide: 'IInvestmentRepository', useValue: spies }],
  }).compile();

  setup = module.get(UpsertValuationUseCase);
});
