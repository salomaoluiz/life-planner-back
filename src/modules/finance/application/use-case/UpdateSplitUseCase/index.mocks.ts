import { Test } from '@nestjs/testing';

import { UpdateSplitInput } from '@finance/application/dto/UpdateSplit';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { GetSplitUseCase } from '@finance/application/use-case/GetSplitUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import SplitEntityFixture from '@finance/domain/entity/mocks/SplitEntity.fixture';
import { TransactionType } from '@finance/domain/enum';

import { UpdateSplitUseCase } from './index';

// region Mocks

const split = new SplitEntityFixture().build();
const account = new AccountEntityFixture()
  .withId(split.accountId as string)
  .withOwner(split.owner)
  .withOwnerId(split.ownerId)
  .build();
const card = new CreditCardEntityFixture()
  .withId('card-1')
  .withOwner(split.owner)
  .withOwnerId(split.ownerId)
  .build();
const accessibleOwners = [{ owner: split.owner, ownerId: split.ownerId }];
const fullInput: UpdateSplitInput = {
  accessibleOwners,
  id: split.id,
  parts: [
    {
      categoryId: split.parts[0].categoryId,
      id: split.parts[0].id,
      type: TransactionType.EXPENSE,
      value: 20000,
    },
    { categoryId: 'cat-9', type: TransactionType.EXPENSE, value: 1000 },
  ],
};

// endregion Mocks

const accountRepositoryMock = { findAccountById: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const ensureConsistencyUseCaseMock = { execute: jest.fn() };
const getSplitUseCaseMock = { execute: jest.fn() };
const splitRepositoryMock = { setSplitPaid: jest.fn(), updateSplit: jest.fn() };

let setup: UpdateSplitUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(account);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(card);
  ensureConsistencyUseCaseMock.execute.mockResolvedValue({});
  getSplitUseCaseMock.execute.mockResolvedValue(split);
  splitRepositoryMock.setSplitPaid.mockResolvedValue(split);
  splitRepositoryMock.updateSplit.mockResolvedValue({ split });

  const module = await Test.createTestingModule({
    providers: [
      UpdateSplitUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyUseCaseMock },
      { provide: GetSplitUseCase, useValue: getSplitUseCaseMock },
      { provide: 'IFinanceSplitRepository', useValue: splitRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateSplitUseCase);
});

const mocks = { accessibleOwners, account, card, fullInput, split };
const spies = {
  accountRepository: accountRepositoryMock,
  ensureConsistency: ensureConsistencyUseCaseMock,
  getSplitUseCase: getSplitUseCaseMock,
  splitRepository: splitRepositoryMock,
};

export { mocks, setup, spies };
