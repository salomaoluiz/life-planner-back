import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';

import { AttachAccountBalancesUseCase } from './index';

// region Mocks

const today = '2026-10-15';
const fixture = new AccountEntityFixture();
const accountA = fixture.withId('account-a').withLedgerBalance(15000).build();
const accountB = fixture.withId('account-b').withLedgerBalance(-300).build();

const accountRepositoryMock = { findUnpaidSums: jest.fn() };

// endregion Mocks

let setup: AttachAccountBalancesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findUnpaidSums.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      AttachAccountBalancesUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
    ],
  }).compile();

  setup = module.get(AttachAccountBalancesUseCase);
});

const mocks = { accountA, accountB, accountRepository: accountRepositoryMock, today };
const spies = {};

export { mocks, setup, spies };
