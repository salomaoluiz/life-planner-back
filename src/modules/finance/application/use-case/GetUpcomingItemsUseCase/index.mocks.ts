import { Test } from '@nestjs/testing';

import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { InvoiceStatus, TransactionType } from '@finance/domain/enum';
import { UnpaidAccountRow } from '@finance/domain/repository';
import { Invoice } from '@finance/domain/service/InvoiceCalculator';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetUpcomingItemsUseCase } from './index';

// region Mocks

const ownerId = 'user-a';
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId }],
  today: '2026-11-12',
};
const cardMock = new CreditCardEntityFixture()
  .withOwner(OwnerType.USER)
  .withOwnerId(ownerId)
  .build();

function invoiceMock(overrides: Partial<Invoice> = {}): Invoice {
  return {
    amount: 5000,
    amountDue: 5000,
    currency: 'BRL',
    paymentDate: '2026-11-15',
    referenceMonth: '2026-11',
    status: InvoiceStatus.CLOSED,
    ...overrides,
  } as Invoice;
}
function rowMock(date: string, overrides: { id?: string; value?: number } = {}): UnpaidAccountRow {
  return {
    accountId: 'account-a',
    categoryId: 'category-a',
    currency: 'BRL',
    date,
    description: 'Rent',
    id: overrides.id ?? `row-${date}`,
    occurrenceNumber: null,
    owner: OwnerType.USER,
    ownerId,
    recurrenceId: null,
    type: TransactionType.EXPENSE,
    value: overrides.value ?? 1000,
  };
}

const transactionRepositoryMock = {
  countCardPurchasesByInvoice: jest.fn(),
  findUnpaidAccountRows: jest.fn(),
};
const findInvoicesMock = { execute: jest.fn() };
const projectionsMock = { execute: jest.fn() };

// endregion Mocks

let setup: GetUpcomingItemsUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  transactionRepositoryMock.findUnpaidAccountRows.mockResolvedValue([]);
  transactionRepositoryMock.countCardPurchasesByInvoice.mockResolvedValue([]);
  findInvoicesMock.execute.mockResolvedValue([]);
  projectionsMock.execute.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetUpcomingItemsUseCase,
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
      { provide: FindInvoicesInRangeUseCase, useValue: findInvoicesMock },
      { provide: GetProjectionsUseCase, useValue: projectionsMock },
    ],
  }).compile();

  setup = module.get(GetUpcomingItemsUseCase);
});

const mocks = {
  card: cardMock,
  findInvoices: findInvoicesMock,
  input: inputMock,
  invoice: invoiceMock,
  projections: projectionsMock,
  row: rowMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
