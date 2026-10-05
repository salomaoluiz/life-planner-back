import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { TransactionController } from '@api/finance/v1/transaction.controller';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const transactionApiMock = {
  account: { icon: 'bank', id: faker.string.uuid(), name: 'Checking' },
  accountId: faker.string.uuid(),
  category: { icon: 'cart', iconColor: '#2E7D32', id: faker.string.uuid(), name: 'Groceries' },
  categoryId: faker.string.uuid(),
  createdAt: '2026-10-04T12:00:00.000Z',
  date: '2026-10-03',
  description: 'Weekly groceries',
  id: faker.string.uuid(),
  owner: 'USER',
  ownerId: userId,
  type: 'EXPENSE',
  updatedAt: '2026-10-04T12:00:00.000Z',
  value: 23490,
};
const requestMock = { user: { id: userId } } as JwtPayload & Request;

const transactionServiceMock = {
  create: jest.fn().mockResolvedValue(transactionApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([transactionApiMock]),
  update: jest.fn().mockResolvedValue(transactionApiMock),
};

// endregion Mocks

let setup: TransactionController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [TransactionController],
    providers: [{ provide: TransactionService, useValue: transactionServiceMock }],
  }).compile();

  setup = module.get(TransactionController);
});

const mocks = {
  request: requestMock,
  transaction: transactionApiMock,
  transactionService: transactionServiceMock,
};
const spies = {};

export { mocks, setup, spies };
