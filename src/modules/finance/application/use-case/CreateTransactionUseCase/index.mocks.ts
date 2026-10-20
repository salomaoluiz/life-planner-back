import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateTransactionUseCase } from './index';

// region Mocks

const transactionMock = new TransactionEntityFixture().build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: transactionMock.ownerId }],
  accountId: transactionMock.accountId as string,
  categoryId: transactionMock.categoryId,
  date: '2026-10-03',
  description: 'Weekly groceries',
  owner: OwnerType.USER,
  ownerId: transactionMock.ownerId,
  today: '2026-10-15',
  type: TransactionType.EXPENSE,
  value: 23490,
};
const cardMock = new CreditCardEntityFixture()
  .withOwnerId(transactionMock.ownerId)
  .withLimit(10_000)
  .build();
const computeMock = { execute: jest.fn() };

const accountMock = new AccountEntityFixture().build();
const ensureConsistencyMock = { execute: jest.fn().mockResolvedValue({ account: accountMock }) };
const transactionRepositoryMock = {
  createTransaction: jest.fn().mockResolvedValue(transactionMock),
};

// endregion Mocks

let setup: CreateTransactionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  ensureConsistencyMock.execute.mockResolvedValue({ account: accountMock });
  computeMock.execute.mockResolvedValue([{ invoices: { used: 5000 } }]);

  const module = await Test.createTestingModule({
    providers: [
      CreateTransactionUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateTransactionUseCase);
});

const mocks = {
  account: accountMock,
  card: cardMock,
  compute: computeMock,
  ensureConsistency: ensureConsistencyMock,
  input: inputMock,
  transaction: transactionMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
