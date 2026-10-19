import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinanceRecurrenceDatasource } from './index';

// region Spies

const accountUpdateSpy = jest.fn();
const paymentFindFirstSpy = jest.fn();
const paymentFindManySpy = jest.fn();
const queryRawSpy = jest.fn();
const recurrenceCreateSpy = jest.fn();
const recurrenceFindManySpy = jest.fn();
const recurrenceFindUniqueSpy = jest.fn();
const recurrenceUpdateSpy = jest.fn();
const rowCreateManySpy = jest.fn();
const rowCreateSpy = jest.fn();
const rowDeleteManySpy = jest.fn();
const rowFindFirstSpy = jest.fn();
const rowFindManySpy = jest.fn();
const rowUpdateManySpy = jest.fn();
const rowUpdateSpy = jest.fn();
const transactionSpy = jest.fn();

// endregion Spies

const clientMock = {
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialAccount: { update: accountUpdateSpy },
  financialInvoicePayment: { findFirst: paymentFindFirstSpy, findMany: paymentFindManySpy },
  financialRecurrence: {
    create: recurrenceCreateSpy,
    findMany: recurrenceFindManySpy,
    findUnique: recurrenceFindUniqueSpy,
    update: recurrenceUpdateSpy,
  },
  financialTransaction: {
    create: rowCreateSpy,
    createMany: rowCreateManySpy,
    deleteMany: rowDeleteManySpy,
    findFirst: rowFindFirstSpy,
    findMany: rowFindManySpy,
    update: rowUpdateSpy,
    updateMany: rowUpdateManySpy,
  },
};

let setup: FinanceRecurrenceDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );
  paymentFindFirstSpy.mockResolvedValue(null);
  recurrenceCreateSpy.mockResolvedValue({ id: 'recurrence-1' });
  paymentFindManySpy.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      FinanceRecurrenceDatasource,
      { provide: Database, useValue: { client: clientMock } as unknown as Database },
    ],
  }).compile();

  setup = module.get(FinanceRecurrenceDatasource);
});

const sourceMock = {
  account_id: 'account-1',
  category_id: 'cat-1',
  credit_card_id: null,
  description: 'Rent',
  id: 'recurrence-1',
  owner: 'USER' as const,
  owner_id: 'owner-1',
  type: 'EXPENSE' as const,
  value: 200000,
};

const mocks = {
  accountParams: {
    account_id: 'account-1',
    category_id: 'cat-1',
    description: 'Rent',
    end_date: null,
    frequency: 'MONTHLY' as const,
    last_generated_number: 1,
    next_occurrence_date: new Date('2026-11-05T00:00:00.000Z'),
    owner: 'USER' as const,
    owner_id: 'owner-1',
    rows: [{ date: new Date('2026-10-05T00:00:00.000Z'), number: 1, paid: true }],
    start_date: new Date('2026-10-05T00:00:00.000Z'),
    status: 'ACTIVE' as const,
    type: 'EXPENSE' as const,
    value: 200000,
  },
  source: sourceMock,
};
const spies = {
  accountUpdate: accountUpdateSpy,
  paymentFindFirst: paymentFindFirstSpy,
  paymentFindMany: paymentFindManySpy,
  queryRaw: queryRawSpy,
  recurrenceCreate: recurrenceCreateSpy,
  recurrenceFindMany: recurrenceFindManySpy,
  recurrenceFindUnique: recurrenceFindUniqueSpy,
  recurrenceUpdate: recurrenceUpdateSpy,
  rowCreate: rowCreateSpy,
  rowCreateMany: rowCreateManySpy,
  rowDeleteMany: rowDeleteManySpy,
  rowFindFirst: rowFindFirstSpy,
  rowFindMany: rowFindManySpy,
  rowUpdate: rowUpdateSpy,
  rowUpdateMany: rowUpdateManySpy,
  transaction: transactionSpy,
};

export { mocks, setup, spies };
