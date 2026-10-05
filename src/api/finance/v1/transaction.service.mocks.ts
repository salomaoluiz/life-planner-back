import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const transactionResultMock = {
  account: { icon: 'bank', id: faker.string.uuid(), name: 'Checking' },
  accountId: faker.string.uuid(),
  category: { icon: 'cart', iconColor: '#2E7D32', id: faker.string.uuid(), name: 'Groceries' },
  categoryId: faker.string.uuid(),
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  date: '2026-10-03',
  description: 'Weekly groceries',
  id: faker.string.uuid(),
  owner: OwnerType.USER,
  ownerId: userId,
  type: TransactionType.EXPENSE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
  value: 23490,
};
const transactionApiMock = {
  ...transactionResultMock,
  createdAt: '2026-10-04T12:00:00.000Z',
  owner: 'USER',
  type: 'EXPENSE',
  updatedAt: '2026-10-04T13:00:00.000Z',
};

const createTransactionUseCaseMock = {
  execute: jest.fn().mockResolvedValue(transactionResultMock),
};
const deleteTransactionUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getTransactionsUseCaseMock = {
  execute: jest.fn().mockResolvedValue([transactionResultMock]),
};
const updateTransactionUseCaseMock = {
  execute: jest.fn().mockResolvedValue(transactionResultMock),
};

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
      { provide: UpdateTransactionUseCase, useValue: updateTransactionUseCaseMock },
    ],
  }).compile();

  setup = module.get(TransactionService);
});

const mocks = {
  accessibleOwners,
  createTransactionUseCase: createTransactionUseCaseMock,
  deleteTransactionUseCase: deleteTransactionUseCaseMock,
  getTransactionsUseCase: getTransactionsUseCaseMock,
  transactionApi: transactionApiMock,
  updateTransactionUseCase: updateTransactionUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
