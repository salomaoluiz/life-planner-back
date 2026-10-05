import { Test } from '@nestjs/testing';

import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateTransactionUseCase } from './index';

// region Mocks

const transactionMock = new TransactionEntityFixture().build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: transactionMock.ownerId }],
  accountId: transactionMock.accountId,
  categoryId: transactionMock.categoryId,
  date: '2026-10-03',
  description: 'Weekly groceries',
  owner: OwnerType.USER,
  ownerId: transactionMock.ownerId,
  type: TransactionType.EXPENSE,
  value: 23490,
};

const ensureConsistencyMock = { execute: jest.fn().mockResolvedValue(undefined) };
const transactionRepositoryMock = {
  createTransaction: jest.fn().mockResolvedValue(transactionMock),
};

// endregion Mocks

let setup: CreateTransactionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  ensureConsistencyMock.execute.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      CreateTransactionUseCase,
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateTransactionUseCase);
});

const mocks = {
  ensureConsistency: ensureConsistencyMock,
  input: inputMock,
  transaction: transactionMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
