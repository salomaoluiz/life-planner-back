import { Test } from '@nestjs/testing';

import { GetSplitUseCase } from '@finance/application/use-case/GetSplitUseCase';
import SplitEntityFixture from '@finance/domain/entity/mocks/SplitEntity.fixture';

import { DeleteSplitUseCase } from './index';

// region Mocks

const split = new SplitEntityFixture().build();
const accessibleOwners = [{ owner: split.owner, ownerId: split.ownerId }];

// endregion Mocks

const getSplitUseCaseMock = { execute: jest.fn() };
const splitRepositoryMock = { deleteSplit: jest.fn() };

let setup: DeleteSplitUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  getSplitUseCaseMock.execute.mockResolvedValue(split);

  const module = await Test.createTestingModule({
    providers: [
      DeleteSplitUseCase,
      { provide: GetSplitUseCase, useValue: getSplitUseCaseMock },
      { provide: 'IFinanceSplitRepository', useValue: splitRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteSplitUseCase);
});

const mocks = { accessibleOwners, split };
const spies = { getSplitUseCase: getSplitUseCaseMock, splitRepository: splitRepositoryMock };

export { mocks, setup, spies };
