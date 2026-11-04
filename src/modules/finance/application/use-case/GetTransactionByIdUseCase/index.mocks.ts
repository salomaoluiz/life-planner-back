import { Test } from '@nestjs/testing';

import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetTransactionByIdUseCase } from './index';

// region Mocks

const transactionMock = new TransactionEntityFixture().build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: transactionMock.ownerId }];

const transactionRepositoryMock = {
  findTransactionById: jest.fn(),
};

// endregion Mocks

let setup: GetTransactionByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionRepositoryMock.findTransactionById.mockResolvedValue(transactionMock);

  const module = await Test.createTestingModule({
    providers: [
      GetTransactionByIdUseCase,
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetTransactionByIdUseCase);
});

export const mocks = {
  accessibleOwners,
  transaction: transactionMock,
  transactionRepository: transactionRepositoryMock,
};

export { setup };
