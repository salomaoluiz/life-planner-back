import { Test } from '@nestjs/testing';

import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ExportTransactionsUseCase } from './index';

// region Mocks

const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { archived: true, owner: OwnerType.FAMILY, ownerId: 'family-id' },
];
const parent = { id: 'parent', name: 'Casa', parentId: undefined };
const child = { id: 'child', name: 'Mercado', parentId: 'parent' };
const transactionMock = {
  ...new TransactionEntityFixture().build(),
  categoryId: 'child',
  date: '2026-10-02',
  description: 'Supermercado',
  owner: OwnerType.USER,
  ownerId: 'user-id',
};
const familyTransactionMock = {
  ...transactionMock,
  owner: OwnerType.FAMILY,
  ownerId: 'family-id',
};

const categoryRepositoryMock = { findCategories: jest.fn() };
const resolvePaidMock = { execute: jest.fn() };
const transactionRepositoryMock = { findTransactionsForExport: jest.fn() };

// endregion Mocks

let setup: ExportTransactionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategories.mockResolvedValue([parent, child]);
  resolvePaidMock.execute.mockImplementation(async ({ transactions }) => transactions);
  transactionRepositoryMock.findTransactionsForExport.mockResolvedValue([
    transactionMock,
    familyTransactionMock,
  ]);

  const module = await Test.createTestingModule({
    providers: [
      ExportTransactionsUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
      { provide: ResolveCardRowsPaidUseCase, useValue: resolvePaidMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(ExportTransactionsUseCase);
});

const mocks = {
  accessibleOwners,
  categoryRepository: categoryRepositoryMock,
  resolvePaid: resolvePaidMock,
  transactionRepository: transactionRepositoryMock,
  transactions: { family: familyTransactionMock, user: transactionMock },
};

export { mocks, setup };
