import { Test } from '@nestjs/testing';

import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteTransactionUseCase } from './index';

// region Mocks

const transactionMock = new TransactionEntityFixture().build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: transactionMock.ownerId }];

const cardCreditRepositoryMock = {
  countRefundsByTransactionId: jest.fn().mockResolvedValue(0),
};
const transactionRepositoryMock = {
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
  findTransactionById: jest.fn().mockResolvedValue(transactionMock),
};

// endregion Mocks

let setup: DeleteTransactionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  cardCreditRepositoryMock.countRefundsByTransactionId.mockResolvedValue(0);
  transactionRepositoryMock.findTransactionById.mockResolvedValue(transactionMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteTransactionUseCase,
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteTransactionUseCase);
});

const mocks = {
  accessibleOwners,
  cardCreditRepository: cardCreditRepositoryMock,
  transaction: transactionMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
