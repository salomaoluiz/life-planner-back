import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinancialInvoicePaymentWithAccount } from '@finance/data/repository/datasource/IFinanceInvoicePaymentDatasource';
import { Database } from '@shared/infra/db/Database';

import { FinanceInvoicePaymentDatasource } from './index';

// region Mocks

const paymentMock: FinancialInvoicePaymentWithAccount = {
  account: { name: 'Checking' },
  account_id: faker.string.uuid(),
  amount: 45000,
  created_at: faker.date.past(),
  credit_card_id: 'card-1',
  id: faker.string.uuid(),
  invoice_month: '2026-10',
  method: 'ACCOUNT',
  owner: 'USER',
  owner_id: faker.string.uuid(),
  paid_on: new Date('2026-11-05T00:00:00.000Z'),
  transaction_id: 'tx-1',
  updated_at: faker.date.recent(),
};
const payParams = {
  account_id: 'acc-1',
  account_owner: 'USER' as const,
  account_owner_id: 'owner-1',
  amount: 45000,
  category_id: 'cat-1',
  credit_card_id: 'card-1',
  currency: 'BRL' as const,
  description: 'Invoice payment',
  invoice_month: '2026-10',
  method: 'ACCOUNT' as const,
  owner: 'USER' as const,
  owner_id: 'owner-1',
  paid_on: new Date('2026-11-05T00:00:00.000Z'),
};

// endregion Mocks

// region Spies

const accountUpdateSpy = jest.fn();
const aggregateSpy = jest.fn();
const paymentCreateSpy = jest.fn();
const paymentDeleteManySpy = jest.fn();
const paymentFindFirstSpy = jest.fn();
const paymentFindManySpy = jest.fn();
const queryRawSpy = jest.fn();
const transactionCreateSpy = jest.fn();
const transactionDeleteManySpy = jest.fn();
const transactionSpy = jest.fn();

// endregion Spies

const clientMock = {
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialAccount: { update: accountUpdateSpy },
  financialInvoicePayment: {
    create: paymentCreateSpy,
    deleteMany: paymentDeleteManySpy,
    findFirst: paymentFindFirstSpy,
    findMany: paymentFindManySpy,
  },
  financialTransaction: {
    aggregate: aggregateSpy,
    create: transactionCreateSpy,
    deleteMany: transactionDeleteManySpy,
  },
};

let setup: FinanceInvoicePaymentDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );

  const module = await Test.createTestingModule({
    providers: [
      FinanceInvoicePaymentDatasource,
      { provide: Database, useValue: { client: clientMock } as unknown as Database },
    ],
  }).compile();

  setup = module.get<FinanceInvoicePaymentDatasource>(FinanceInvoicePaymentDatasource);
});

const mocks = { payment: paymentMock, payParams };
const spies = {
  accountUpdate: accountUpdateSpy,
  aggregate: aggregateSpy,
  paymentCreate: paymentCreateSpy,
  paymentDeleteMany: paymentDeleteManySpy,
  paymentFindFirst: paymentFindFirstSpy,
  paymentFindMany: paymentFindManySpy,
  queryRaw: queryRawSpy,
  transactionCreate: transactionCreateSpy,
  transactionDeleteMany: transactionDeleteManySpy,
};

export { mocks, setup, spies };
