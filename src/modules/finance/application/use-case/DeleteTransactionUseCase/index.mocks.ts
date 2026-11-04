import { Test } from '@nestjs/testing';

import { MaterializationGate } from '@finance/application/service/MaterializationGate';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteTransactionUseCase } from './index';

// region Mocks

const transactionMock = new TransactionEntityFixture().build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: transactionMock.ownerId }];

const cardCreditRepositoryMock = {
  countRefundsByTransactionId: jest.fn().mockResolvedValue(0),
};
const recurrenceRepositoryMock = {
  findById: jest.fn(),
  skipNumber: jest.fn().mockResolvedValue(undefined),
};
const recurringMock = new TransactionEntityFixture().withRecurrence('series-1', 4, 10).build();
const transactionRepositoryMock = {
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
  findTransactionScalarsById: jest.fn().mockResolvedValue(transactionMock),
};

// endregion Mocks

const gateMock = { invalidate: jest.fn() };

let setup: DeleteTransactionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  cardCreditRepositoryMock.countRefundsByTransactionId.mockResolvedValue(0);
  transactionRepositoryMock.findTransactionScalarsById.mockResolvedValue(transactionMock);
  recurrenceRepositoryMock.findById.mockResolvedValue({
    firstNumber: 1,
    id: 'series-1',
    lastGeneratedNumber: 6,
    ownerId: 'user-id',
  });
  recurrenceRepositoryMock.skipNumber.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      { provide: MaterializationGate, useValue: gateMock },
      DeleteTransactionUseCase,
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteTransactionUseCase);
});

const mocks = {
  accessibleOwners,
  cardCreditRepository: cardCreditRepositoryMock,
  gate: gateMock,
  recurrenceRepository: recurrenceRepositoryMock,
  recurring: recurringMock,
  transaction: transactionMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
