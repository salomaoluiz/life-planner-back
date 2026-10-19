import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const transactionResultMock = {
  account: { icon: 'bank', id: faker.string.uuid(), name: 'Checking' },
  accountId: faker.string.uuid(),
  category: {
    excludeFromTotals: false,
    icon: 'cart',
    iconColor: '#2E7D32',
    id: faker.string.uuid(),
    name: 'Groceries',
    systemKey: null,
  },
  categoryId: faker.string.uuid(),
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  creditCard: null,
  creditCardId: null,
  date: '2026-10-03',
  description: 'Weekly groceries',
  id: faker.string.uuid(),
  invoiceMonth: null,
  owner: OwnerType.USER,
  ownerId: userId,
  paid: true,
  type: TransactionType.EXPENSE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
  value: 23490,
};
const transactionApiMock = {
  ...transactionResultMock,
  createdAt: '2026-10-04T12:00:00.000Z',
  overLimit: undefined,
  owner: 'USER',
  type: 'EXPENSE',
  updatedAt: '2026-10-04T13:00:00.000Z',
};

const createTransactionUseCaseMock = {
  execute: jest.fn().mockResolvedValue({ overLimit: false, transaction: transactionResultMock }),
};
const deleteTransactionUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getTransactionsUseCaseMock = {
  execute: jest.fn().mockResolvedValue([transactionResultMock]),
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
  getTransactionsUseCase: getTransactionsUseCaseMock,
  materializeRecurrencesUseCase: materializeRecurrencesUseCaseMock,
  resolveCardRowsPaidUseCase: resolveCardRowsPaidUseCaseMock,
  transactionApi: transactionApiMock,
  transactionResult: transactionResultMock,
  updateTransactionUseCase: updateTransactionUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
