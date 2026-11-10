import { Test } from '@nestjs/testing';

import { quoteProviders } from '@investment/application/service/QuoteContext/index.mocks';
import {
  assetFixture,
  operationFixture,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';

import { GetAssetByIdUseCase } from './index';

export const spies = repositorySpies();

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const asset = assetFixture({ ownerId: 'user-1' });

export const mocks = {
  asset,
  detail: { ...asset, operations: [], valuations: [] },
  detailWithOperation: {
    ...asset,
    operations: [operationFixture({ assetId: asset.id })],
    valuations: [],
  },
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
};

export let setup: GetAssetByIdUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetAssetByIdUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      ...quoteProviders,
    ],
  }).compile();

  setup = module.get(GetAssetByIdUseCase);
});
