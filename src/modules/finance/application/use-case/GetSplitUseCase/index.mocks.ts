import { Test } from '@nestjs/testing';

import SplitEntityFixture from '@finance/domain/entity/mocks/SplitEntity.fixture';

import { GetSplitUseCase } from './index';

// region Mocks

const split = new SplitEntityFixture().build();
const accessibleOwners = [{ owner: split.owner, ownerId: split.ownerId }];

// endregion Mocks

const splitRepositoryMock = { findSplitById: jest.fn() };

let setup: GetSplitUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  splitRepositoryMock.findSplitById.mockResolvedValue(split);

  const module = await Test.createTestingModule({
    providers: [
      GetSplitUseCase,
      { provide: 'IFinanceSplitRepository', useValue: splitRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetSplitUseCase);
});

const mocks = { accessibleOwners, split };
const spies = { splitRepository: splitRepositoryMock };

export { mocks, setup, spies };
