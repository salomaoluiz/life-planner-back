import { Test } from '@nestjs/testing';

import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteTransactionUseCase } from './index';

// region Mocks

const transactionMock = new TransactionEntityFixture().build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: transactionMock.ownerId }];

const transactionRepositoryMock = {
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
  findTransactionById: jest.fn().mockResolvedValue(transactionMock),
};

// endregion Mocks

let setup: DeleteTransactionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionRepositoryMock.findTransactionById.mockResolvedValue(transactionMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteTransactionUseCase,
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteTransactionUseCase);
});

const mocks = {
  accessibleOwners,
  transaction: transactionMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
