import { Test } from '@nestjs/testing';

import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { ResolveSearchCategoryIdsUseCase } from '@finance/application/use-case/ResolveSearchCategoryIdsUseCase';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetTransactionsUseCase } from './index';

// region Mocks

const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { owner: OwnerType.FAMILY, ownerId: 'family-id' },
];
const transactionsMock = [
  new TransactionEntityFixture().build(),
  new TransactionEntityFixture().build(),
];

const expandMock = { execute: jest.fn() };
const resolveSearchMock = { execute: jest.fn() };
const findInvoicesMock = { execute: jest.fn() };
const transactionRepositoryMock = {
  findTransactions: jest.fn().mockResolvedValue(transactionsMock),
};

// endregion Mocks

let setup: GetTransactionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionRepositoryMock.findTransactions.mockResolvedValue(transactionsMock);
  expandMock.execute.mockImplementation(async ({ categoryIds }) => categoryIds);
  resolveSearchMock.execute.mockResolvedValue([]);
  findInvoicesMock.execute.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetTransactionsUseCase,
      { provide: ExpandCategoryIdsUseCase, useValue: expandMock },
      { provide: ResolveSearchCategoryIdsUseCase, useValue: resolveSearchMock },
      { provide: FindInvoicesInRangeUseCase, useValue: findInvoicesMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetTransactionsUseCase);
});

const mocks = {
  accessibleOwners,
  expand: expandMock,
  findInvoices: findInvoicesMock,
  resolveSearch: resolveSearchMock,
  transactionRepository: transactionRepositoryMock,
  transactions: transactionsMock,
};
const spies = {};

export { mocks, setup, spies };
