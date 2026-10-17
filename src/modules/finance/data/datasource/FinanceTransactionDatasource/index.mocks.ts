import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { FinanceTransactionDatasource } from './index';

// region Mocks

const transactionMock: FinancialTransactionWithRelations = {
  account: { icon: 'bank', id: faker.string.uuid(), name: 'Checking' },
  account_id: faker.string.uuid(),
  category: {
    exclude_from_totals: false,
    icon: 'cart',
    icon_color: '#2E7D32',
    id: faker.string.uuid(),
    name: 'Groceries',
    system_key: null,
  },
  category_id: faker.string.uuid(),
  created_at: faker.date.past(),
  credit_card: null,
  credit_card_id: null,
  date: new Date('2026-10-03T00:00:00.000Z'),
  description: 'Weekly groceries',
  early_payment: null,
  id: faker.string.uuid(),
  installment_number: null,
  installment_plan: null,
  installment_plan_id: null,
  invoice_month: null,
  owner: 'USER',
  owner_id: faker.string.uuid(),
  paid_from_transaction: null,
  paid_from_transaction_id: null,
  payment_method: null,
  prepayment_id: null,
  refunded_plan: null,
  refunded_plan_id: null,
  refunded_transaction: null,
  refunded_transaction_id: null,
  type: 'EXPENSE',
  updated_at: faker.date.recent(),
  value: 23490,
};
const ownersMock = [{ owner: OwnerType.USER, ownerId: transactionMock.owner_id }];
const includeMock = {
  account: { select: { icon: true, id: true, name: true } },
  category: {
    select: {
      exclude_from_totals: true,
      icon: true,
      icon_color: true,
      id: true,
      name: true,
      system_key: true,
    },
  },
  credit_card: { select: { color: true, id: true, last_digits: true, title: true } },
  early_payment: { select: { credit_card_id: true, id: true, invoice_month: true } },
  installment_plan: { select: { installment_count: true } },
  paid_from_transaction: {
    select: { account: { select: { name: true } }, account_id: true },
  },
  refunded_plan: { select: { description: true } },
  refunded_transaction: { select: { description: true } },
};

// endregion Mocks

// region Spies

const accountUpdateSpy = jest.fn();
const paymentFindFirstSpy = jest.fn();
const countSpy = jest.fn();
const planCountSpy = jest.fn();
const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const findManySpy = jest.fn();
const groupBySpy = jest.fn();
const findUniqueSpy = jest.fn();
const queryRawSpy = jest.fn();
const transactionSpy = jest.fn();
const updateSpy = jest.fn();

// endregion Spies

// The interactive $transaction hands the same client to the callback, so one object plays both roles.
const clientMock = {
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialAccount: { update: accountUpdateSpy },
  financialInstallmentPlan: { count: planCountSpy },
  financialInvoicePayment: { findFirst: paymentFindFirstSpy },
  financialTransaction: {
    count: countSpy,
    create: createSpy,
    deleteMany: deleteManySpy,
    findFirst: findFirstSpy,
    findMany: findManySpy,
    findUnique: findUniqueSpy,
    groupBy: groupBySpy,
    update: updateSpy,
  },
};
const databaseMock = { client: clientMock } as unknown as Database;

let setup: FinanceTransactionDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );

  const module = await Test.createTestingModule({
    providers: [FinanceTransactionDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FinanceTransactionDatasource>(FinanceTransactionDatasource);
});

const mocks = { include: includeMock, owners: ownersMock, transaction: transactionMock };
const spies = {
  accountUpdate: accountUpdateSpy,
  count: countSpy,
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  groupBy: groupBySpy,
  paymentFindFirst: paymentFindFirstSpy,
  planCount: planCountSpy,
  queryRaw: queryRawSpy,
  transaction: transactionSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
