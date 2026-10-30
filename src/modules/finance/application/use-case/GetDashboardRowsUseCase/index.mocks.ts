import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { ResolveSearchCategoryIdsUseCase } from '@finance/application/use-case/ResolveSearchCategoryIdsUseCase';
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
const resolveSearchMock = { execute: jest.fn() };
const projectionsMock = { executeChunked: jest.fn() };

function occurrenceOf(overrides: Record<string, unknown> = {}) {
  return {
    category: { id: 'cat-1' },
    creditCard: null,
    currency: 'BRL',
    date: '2026-11-10',
    invoiceListDate: null,
    tags: [],
    type: 'EXPENSE',
    value: 10000,
    ...overrides,
  };
}
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
  projectionsMock.executeChunked.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetDashboardRowsUseCase,
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: ExpandCategoryIdsUseCase, useValue: expandMock },
      { provide: ResolveSearchCategoryIdsUseCase, useValue: resolveSearchMock },
      { provide: GetProjectionsUseCase, useValue: projectionsMock },
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
  occurrenceOf,
  projections: projectionsMock,
  resolveSearch: resolveSearchMock,
  sumOf,
  transactionRepository: transactionRepositoryMock,
};

export { mocks, setup };
