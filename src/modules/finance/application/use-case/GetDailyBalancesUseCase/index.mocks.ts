import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { DayBalance } from '@finance/domain/service/DailyBalance';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetDailyBalancesUseCase } from './index';

// region Mocks

const ownerId = 'user-a';
const accountMock = new AccountEntityFixture()
  .withOwner(OwnerType.USER)
  .withOwnerId(ownerId)
  .withName('Checking')
  .withInitialBalance(100000)
  .withLedgerBalance(70000)
  .build();
const cardMock = new CreditCardEntityFixture().withOwnerId(ownerId).build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId }],
  month: '2026-11',
  today: '2026-10-20',
};

const accountRepositoryMock = {
  findAccounts: jest.fn(),
  findPaidSumsFrom: jest.fn(),
  findUnpaidSumsUntil: jest.fn(),
};
const creditCardRepositoryMock = { findCreditCards: jest.fn() };
const computeMock = { execute: jest.fn() };
const projectionsMock = { execute: jest.fn() };

// endregion Mocks

let setup: GetDailyBalancesUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  accountRepositoryMock.findAccounts.mockResolvedValue([accountMock]);
  accountRepositoryMock.findPaidSumsFrom.mockResolvedValue([]);
  accountRepositoryMock.findUnpaidSumsUntil.mockResolvedValue([]);
  creditCardRepositoryMock.findCreditCards.mockResolvedValue([]);
  computeMock.execute.mockResolvedValue([]);
  projectionsMock.execute.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetDailyBalancesUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: GetProjectionsUseCase, useValue: projectionsMock },
    ],
  }).compile();

  setup = module.get(GetDailyBalancesUseCase);
});

function day(days: DayBalance[], date: string): DayBalance {
  return days.find((item) => item.date === date) as DayBalance;
}

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  card: cardMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  projections: projectionsMock,
};
const spies = {};

export { day, mocks, setup, spies };
