import { Test } from '@nestjs/testing';

import {
  DashboardRow,
  GetDashboardRowsUseCase,
} from '@finance/application/use-case/GetDashboardRowsUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetDashboardSummaryUseCase } from './index';

// region Mocks

const ownerId = 'user-a';
const accountMock = new AccountEntityFixture()
  .withId('acc-1')
  .withOwner(OwnerType.USER)
  .withOwnerId(ownerId)
  .withLedgerBalance(70000)
  .build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId }],
  currency: 'BRL' as const,
  from: '2025-11-01',
  to: '2026-10-31',
  today: '2026-10-20',
};

const accountRepositoryMock = { findAccounts: jest.fn(), findPaidSumsFrom: jest.fn() };
const creditCardRepositoryMock = { findCreditCards: jest.fn() };
const rowsMock = { execute: jest.fn() };

function rowOf(overrides: Partial<DashboardRow>): DashboardRow {
  return {
    amount: 1000,
    bucketDate: '2026-10-05',
    categoryId: 'food',
    count: 1,
    projected: false,
    tagId: null,
    type: TransactionType.EXPENSE,
    ...overrides,
  };
}

// endregion Mocks

let setup: GetDashboardSummaryUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  accountRepositoryMock.findAccounts.mockResolvedValue([accountMock]);
  accountRepositoryMock.findPaidSumsFrom.mockResolvedValue([]);
  creditCardRepositoryMock.findCreditCards.mockResolvedValue([
    new CreditCardEntityFixture().withOwnerId(ownerId).build(),
  ]);
  rowsMock.execute.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetDashboardSummaryUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: GetDashboardRowsUseCase, useValue: rowsMock },
    ],
  }).compile();

  setup = module.get(GetDashboardSummaryUseCase);
});

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  input: inputMock,
  rowOf,
  rows: rowsMock,
};

export { mocks, setup };
