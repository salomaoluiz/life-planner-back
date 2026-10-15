import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinanceOwnerDataDatasource } from './index';

// region Spies

const accountDeleteManySpy = jest.fn();
const categoryDeleteManySpy = jest.fn();
const transactionDeleteManySpy = jest.fn();
const transactionSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    $transaction: transactionSpy,
    financialAccount: { deleteMany: accountDeleteManySpy },
    financialCategory: { deleteMany: categoryDeleteManySpy },
    financialTransaction: { deleteMany: transactionDeleteManySpy },
  },
} as unknown as Database;

let setup: FinanceOwnerDataDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [FinanceOwnerDataDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(FinanceOwnerDataDatasource);
});

const mocks = {};
const spies = {
  accountDeleteMany: accountDeleteManySpy,
  categoryDeleteMany: categoryDeleteManySpy,
  transaction: transactionSpy,
  transactionDeleteMany: transactionDeleteManySpy,
};

export { mocks, setup, spies };
