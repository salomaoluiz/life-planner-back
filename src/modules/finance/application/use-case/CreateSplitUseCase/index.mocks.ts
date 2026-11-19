import { Test } from '@nestjs/testing';

import { CreateSplitInput } from '@finance/application/dto/CreateSplit';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import SplitEntityFixture from '@finance/domain/entity/mocks/SplitEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';

import { CreateSplitUseCase } from './index';

// region Mocks

const account = new AccountEntityFixture().withId('acc-1').build();
const card = new CreditCardEntityFixture().withId('card-1').build();
const accessibleOwners = [
  { owner: account.owner, ownerId: account.ownerId },
  { owner: card.owner, ownerId: card.ownerId },
];
const created = new SplitEntityFixture().build();
const ordinaryRow = new TransactionEntityFixture()
  .withDefault()
  .withOwner(account.owner)
  .withOwnerId(account.ownerId)
  .build();
const input: CreateSplitInput = {
  accessibleOwners,
  accountId: 'acc-1',
  date: '2026-11-15',
  description: 'Mercado',
  parts: [
    { categoryId: 'cat-1', type: TransactionType.EXPENSE, value: 12000 },
    {
      categoryId: 'cat-2',
      description: 'Detergente',
      tags: ['casa'],
      type: TransactionType.EXPENSE,
      value: 5000,
    },
    { systemKey: SystemCategoryKey.SPLIT_ADJUSTMENT, type: TransactionType.EXPENSE, value: -440 },
  ],
  requesterId: 'user-1',
  today: '2026-11-18',
  total: 16560,
};

// endregion Mocks

const accountRepositoryMock = { findAccountById: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const ensureConsistencyUseCaseMock = { execute: jest.fn() };
const splitRepositoryMock = { createSplit: jest.fn() };
const transactionRepositoryMock = { findTransactionById: jest.fn() };

let setup: CreateSplitUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(account);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(card);
  ensureConsistencyUseCaseMock.execute.mockResolvedValue({});
  splitRepositoryMock.createSplit.mockResolvedValue(created);
  transactionRepositoryMock.findTransactionById.mockResolvedValue(ordinaryRow);

  const module = await Test.createTestingModule({
    providers: [
      CreateSplitUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyUseCaseMock },
      { provide: 'IFinanceSplitRepository', useValue: splitRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateSplitUseCase);
});

const mocks = { accessibleOwners, account, card, created, input, ordinaryRow };
const spies = {
  accountRepository: accountRepositoryMock,
  creditCardRepository: creditCardRepositoryMock,
  ensureConsistency: ensureConsistencyUseCaseMock,
  splitRepository: splitRepositoryMock,
  transactionRepository: transactionRepositoryMock,
};

export { mocks, setup, spies };
