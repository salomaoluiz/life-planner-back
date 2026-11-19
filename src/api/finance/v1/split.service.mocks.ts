import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { SplitLookupsService } from '@api/finance/v1/split-lookups.service';
import { SplitService } from '@api/finance/v1/split.service';
import { CreateSplitUseCase } from '@finance/application/use-case/CreateSplitUseCase';
import { DeleteSplitUseCase } from '@finance/application/use-case/DeleteSplitUseCase';
import { GetSplitUseCase } from '@finance/application/use-case/GetSplitUseCase';
import { UpdateSplitUseCase } from '@finance/application/use-case/UpdateSplitUseCase';
import SplitEntityFixture from '@finance/domain/entity/mocks/SplitEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';

// region Mocks

const split = new SplitEntityFixture().build();
const accessibleOwners = [{ owner: split.owner, ownerId: split.ownerId }];
const dissolved = new TransactionEntityFixture().withDefault().build();
const userId = 'user-1';

// endregion Mocks

const createSplitUseCaseMock = { execute: jest.fn() };
const deleteSplitUseCaseMock = { execute: jest.fn() };
const financeAccessServiceMock = { resolve: jest.fn() };
const getSplitUseCaseMock = { execute: jest.fn() };
const splitLookupsServiceMock = {
  attach: jest.fn(async (_owners: unknown, _rows: unknown, lookups: unknown) => lookups),
};
const updateSplitUseCaseMock = { execute: jest.fn() };

let setup: SplitService;

beforeEach(async () => {
  jest.clearAllMocks();
  createSplitUseCaseMock.execute.mockResolvedValue(split);
  financeAccessServiceMock.resolve.mockResolvedValue(accessibleOwners);
  getSplitUseCaseMock.execute.mockResolvedValue(split);
  updateSplitUseCaseMock.execute.mockResolvedValue({ split });

  const module = await Test.createTestingModule({
    providers: [
      SplitService,
      { provide: CreateSplitUseCase, useValue: createSplitUseCaseMock },
      { provide: DeleteSplitUseCase, useValue: deleteSplitUseCaseMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetSplitUseCase, useValue: getSplitUseCaseMock },
      { provide: SplitLookupsService, useValue: splitLookupsServiceMock },
      { provide: UpdateSplitUseCase, useValue: updateSplitUseCaseMock },
    ],
  }).compile();

  setup = module.get(SplitService);
});

const mocks = { accessibleOwners, dissolved, split, userId };
const spies = {
  createSplitUseCase: createSplitUseCaseMock,
  deleteSplitUseCase: deleteSplitUseCaseMock,
  getSplitUseCase: getSplitUseCaseMock,
  splitLookupsService: splitLookupsServiceMock,
  updateSplitUseCase: updateSplitUseCaseMock,
};

export { mocks, setup, spies };
