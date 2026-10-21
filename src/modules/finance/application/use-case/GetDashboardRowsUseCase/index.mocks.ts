import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { DashboardSum } from '@finance/domain/repository';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetDashboardRowsUseCase } from './index';

// region Mocks

const ownerId = 'user-a';
const cardMock = new CreditCardEntityFixture().withOwnerId(ownerId).build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId }],
  byTag: false,
  currency: 'BRL' as const,
  from: '2026-01-01',
  to: '2026-10-31',
  today: '2026-10-20',
};

const creditCardRepositoryMock = { findCreditCards: jest.fn() };
const transactionRepositoryMock = { sumDashboardRows: jest.fn() };
const computeMock = { execute: jest.fn() };
const expandMock = { execute: jest.fn() };

function sumOf(overrides: Partial<DashboardSum>): DashboardSum {
  return {
    amount: 1000,
    categoryId: 'cat-1',
    count: 1,
    creditCardId: null,
    date: '2026-10-05',
    invoiceMonth: null,
    paid: true,
    tagId: null,
    type: 'EXPENSE' as DashboardSum['type'],
    ...overrides,
  };
}

// endregion Mocks

let setup: GetDashboardRowsUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  creditCardRepositoryMock.findCreditCards.mockResolvedValue([cardMock]);
  computeMock.execute.mockResolvedValue([
    { card: cardMock, invoices: {}, payments: [], totals: [] },
  ]);
  expandMock.execute.mockImplementation(async ({ categoryIds }) => Promise.resolve(categoryIds));
  transactionRepositoryMock.sumDashboardRows.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetDashboardRowsUseCase,
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: ExpandCategoryIdsUseCase, useValue: expandMock },
    ],
  }).compile();

  setup = module.get(GetDashboardRowsUseCase);
});

const mocks = {
  card: cardMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  expand: expandMock,
  input: inputMock,
  sumOf,
  transactionRepository: transactionRepositoryMock,
};

export { mocks, setup };
