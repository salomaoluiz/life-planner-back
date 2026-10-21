import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

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

  const module = await Test.createTestingModule({
    providers: [
      ImportTransactionsUseCase,
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(ImportTransactionsUseCase);
});

const mocks = {
  base,
  ensure: ensureMock,
  errors: {
    notFound: (message: string) => new NotFoundException(message),
    unprocessable: (message: string) => new UnprocessableEntityException(message),
  },
  transactionRepository: transactionRepositoryMock,
  validRow,
};

export { mocks, setup };
