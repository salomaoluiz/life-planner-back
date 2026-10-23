import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ImportTransactionsUseCase } from './index';

// region Mocks

const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { archived: true, owner: OwnerType.FAMILY, ownerId: 'archived-family' },
];
const account = { currency: 'BRL', id: 'acc-1' };
const card = { closingDay: 10, currency: 'BRL', id: 'card-1' };
const creditCard = {
  closingDay: 25,
  createdAt: new Date('2026-01-01'),
  currency: 'BRL',
  dueDay: 5,
  id: 'card-1',
  limit: 1000000,
  owner: OwnerType.USER,
  ownerId: 'user-id',
  status: 'ACTIVE',
  title: 'Visa',
};
const paidFromAccount = {
  currency: 'BRL',
  id: 'acc-1',
  owner: OwnerType.USER,
  ownerId: 'user-id',
  status: 'ACTIVE',
};
const computeTotals: { value: { amount: number; earlyPaid?: number; invoiceMonth: string }[] } = {
  value: [],
};
const validRow = {
  accountId: 'acc-1',
  categoryId: 'cat-1',
  date: '2026-10-02',
  description: 'Supermercado',
  line: 2,
  type: TransactionType.EXPENSE,
  value: 31240,
};
const base = {
  accessibleOwners,
  dryRun: true,
  owner: OwnerType.USER,
  ownerId: 'user-id',
  today: '2026-10-21',
};

const ensureMock = { execute: jest.fn() };
const accountRepositoryMock = { findAccountById: jest.fn() };
const cardCreditRepositoryMock = { createImportRows: jest.fn() };
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const transactionRepositoryMock = {
  createManyTransactions: jest.fn(),
  findDuplicateCandidates: jest.fn(),
};

// endregion Mocks

let setup: ImportTransactionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  ensureMock.execute.mockImplementation(async ({ creditCardId }) =>
    creditCardId ? { card } : { account },
  );
  transactionRepositoryMock.createManyTransactions.mockImplementation(
    async (rows: unknown[]) => rows.length,
  );
  transactionRepositoryMock.findDuplicateCandidates.mockResolvedValue([]);
  cardCreditRepositoryMock.createImportRows.mockImplementation(
    async (params: Record<string, unknown[]>) =>
      Object.values(params).reduce((sum, rows) => sum + rows.length, 0),
  );
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(creditCard);
  accountRepositoryMock.findAccountById.mockResolvedValue(paidFromAccount);
  computeMock.execute.mockImplementation(async () => [
    { card: creditCard, invoices: undefined, payments: [], totals: computeTotals.value },
  ]);
  computeTotals.value = [];

  const module = await Test.createTestingModule({
    providers: [
      ImportTransactionsUseCase,
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(ImportTransactionsUseCase);
});

const mocks = {
  account: accountRepositoryMock,
  base,
  card: creditCardRepositoryMock,
  cardCredit: cardCreditRepositoryMock,
  compute: computeMock,
  computeTotals,
  creditCard,
  ensure: ensureMock,
  errors: {
    notFound: (message: string) => new NotFoundException(message),
    unprocessable: (message: string) => new UnprocessableEntityException(message),
  },
  transactionRepository: transactionRepositoryMock,
  validRow,
};

export { mocks, setup };
