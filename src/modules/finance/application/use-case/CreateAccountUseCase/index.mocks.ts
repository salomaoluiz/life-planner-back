import { Test } from '@nestjs/testing';

import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateAccountUseCase } from './index';

// region Mocks

const accountMock = new AccountEntityFixture()
  .withInitialBalance(152075)
  .withLedgerBalance(152075)
  .build();
const withBalancesMock = { account: accountMock, balance: 152075, projectedBalance: 152075 };
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: accountMock.ownerId }],
  icon: 'bank',
  initialBalance: 152075,
  name: 'Checking',
  owner: OwnerType.USER,
  ownerId: accountMock.ownerId,
  today: '2026-10-15',
};

const accountRepositoryMock = { createAccount: jest.fn() };
const attachMock = { execute: jest.fn() };

// endregion Mocks

let setup: CreateAccountUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.createAccount.mockResolvedValue(accountMock);
  attachMock.execute.mockResolvedValue([withBalancesMock]);

  const module = await Test.createTestingModule({
    providers: [
      CreateAccountUseCase,
      { provide: AttachAccountBalancesUseCase, useValue: attachMock },
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateAccountUseCase);
});

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  attach: attachMock,
  input: inputMock,
  withBalances: withBalancesMock,
};
const spies = {};

export { mocks, setup, spies };
