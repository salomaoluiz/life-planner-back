import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { GetTransactionByIdUseCase } from '@finance/application/use-case/GetTransactionByIdUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const accountId = faker.string.uuid();
const categoryId = faker.string.uuid();
const tagId = faker.string.uuid();
const transactionResultMock = {
  account: { icon: 'bank', id: accountId, name: 'Checking' },
  accountId,
  category: {
    excludeFromTotals: false,
    icon: 'cart',
    iconColor: '#2E7D32',
    id: categoryId,
    name: 'Groceries',
    systemKey: null,
  },
  categoryId,
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  creditCard: null,
  creditCardId: null,
  currency: 'BRL',
  date: '2026-10-03',
  description: 'Weekly groceries',
  earlyPayment: null,
  id: faker.string.uuid(),
  installmentCount: null,
  installmentNumber: null,
  installmentPlanId: null,
  invoiceMonth: null,
  notes: null,
  occurrenceCount: null,
  occurrenceNumber: null,
  owner: OwnerType.USER,
  ownerId: userId,
  paid: true,
  recurrenceFrequency: null,
  recurrenceId: null,
  tags: [{ id: tagId, name: 'home' }],
  type: TransactionType.EXPENSE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
  value: 23490,
};
// Spec 079: ids only, no nulls, no timestamps; the referenced entities once in `lookups`.
const transactionItemMock = {
  accountId,
  categoryId,
  currency: 'BRL',
  date: '2026-10-03',
  description: 'Weekly groceries',
  id: transactionResultMock.id,
  owner: 'USER',
  ownerId: userId,
  paid: true,
  tagIds: [tagId],
  type: 'EXPENSE',
  value: 23490,
};
const transactionLookupsMock = {
  accounts: { [accountId]: { icon: 'bank', name: 'Checking' } },
  categories: { [categoryId]: { icon: 'cart', iconColor: '#2E7D32', name: 'Groceries' } },
  creditCards: {},
  tags: { [tagId]: { name: 'home' } },
};
const transactionApiMock = { item: transactionItemMock, lookups: transactionLookupsMock };

const createTransactionUseCaseMock = {
  execute: jest.fn().mockResolvedValue({ overLimit: false, transaction: transactionResultMock }),
};
const deleteTransactionUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getTransactionByIdUseCaseMock = {
  execute: jest.fn().mockResolvedValue(transactionResultMock),
};
const getTransactionsUseCaseMock = {
  execute: jest.fn().mockResolvedValue({ items: [transactionResultMock], nextCursor: null }),
};
const resolveCardRowsPaidUseCaseMock = {
  execute: jest.fn().mockImplementation(async ({ transactions }) => transactions),
};
const updateTransactionUseCaseMock = {
  execute: jest.fn().mockResolvedValue({ overLimit: false, transaction: transactionResultMock }),
};

const materializeRecurrencesUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };

// endregion Mocks

let setup: TransactionService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      TransactionService,
      { provide: CreateTransactionUseCase, useValue: createTransactionUseCaseMock },
      { provide: DeleteTransactionUseCase, useValue: deleteTransactionUseCaseMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetTransactionByIdUseCase, useValue: getTransactionByIdUseCaseMock },
      { provide: GetTransactionsUseCase, useValue: getTransactionsUseCaseMock },
      { provide: ResolveCardRowsPaidUseCase, useValue: resolveCardRowsPaidUseCaseMock },
      { provide: UpdateTransactionUseCase, useValue: updateTransactionUseCaseMock },
      { provide: MaterializeRecurrencesUseCase, useValue: materializeRecurrencesUseCaseMock },
    ],
  }).compile();

  setup = module.get(TransactionService);
});

const mocks = {
  accessibleOwners,
  createTransactionUseCase: createTransactionUseCaseMock,
  deleteTransactionUseCase: deleteTransactionUseCaseMock,
  getTransactionByIdUseCase: getTransactionByIdUseCaseMock,
  getTransactionsUseCase: getTransactionsUseCaseMock,
  materializeRecurrencesUseCase: materializeRecurrencesUseCaseMock,
  resolveCardRowsPaidUseCase: resolveCardRowsPaidUseCaseMock,
  transactionApi: transactionApiMock,
  transactionItem: transactionItemMock,
  transactionLookups: transactionLookupsMock,
  transactionResult: transactionResultMock,
  updateTransactionUseCase: updateTransactionUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
