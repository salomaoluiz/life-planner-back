import { Test } from '@nestjs/testing';

import { GetDailyBalancesUseCase } from '@finance/application/use-case/GetDailyBalancesUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetBalanceSeriesUseCase } from './index';

// region Mocks

const ownerId = 'user-a';
const accountMock = new AccountEntityFixture()
  .withId('acc-1')
  .withName('Checking')
  .withOwner(OwnerType.USER)
  .withOwnerId(ownerId)
  .withLedgerBalance(70000)
  .build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId }],
  currency: 'BRL' as const,
  from: '2026-08-01',
  granularity: 'MONTH' as const,
  to: '2026-10-31',
  today: '2026-10-20',
};

const accountRepositoryMock = { findAccounts: jest.fn(), findPaidSumsFrom: jest.fn() };
const dailyMock = { execute: jest.fn() };

// endregion Mocks

let setup: GetBalanceSeriesUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  accountRepositoryMock.findAccounts.mockResolvedValue([accountMock]);
  accountRepositoryMock.findPaidSumsFrom.mockResolvedValue([]);
  dailyMock.execute.mockResolvedValue({
    accounts: [accountMock],
    days: [{ accounts: [{ accountId: 'acc-1', balance: 72000 }], date: '2026-10-31' }],
    month: '2026-10',
  });

  const module = await Test.createTestingModule({
    providers: [
      GetBalanceSeriesUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: GetDailyBalancesUseCase, useValue: dailyMock },
    ],
  }).compile();

  setup = module.get(GetBalanceSeriesUseCase);
});

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  daily: dailyMock,
  input: inputMock,
};

export { mocks, setup };
