import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinanceCardCreditDatasource } from './index';

// region Mocks

const date = new Date('2026-10-16T00:00:00.000Z');
const refundParams = {
  category_id: '00000000-0000-4000-8000-000000000004',
  credit_card_id: 'card-1',
  date,
  description: 'Refund · Notebook',
  invoice_month: '2026-10',
  max_linked: 50000,
  owner: 'USER' as const,
  owner_id: 'owner-1',
  refunded_transaction_id: 'purchase-1',
  value: 20000,
};
const earlyParams = {
  account: { id: 'acc-1', owner: 'USER' as const, owner_id: 'owner-1' },
  account_category_id: '00000000-0000-4000-8000-000000000002',
  account_description: 'Early payment · Card (2026-10)',
  category_id: '00000000-0000-4000-8000-000000000005',
  credit_card_id: 'card-1',
  date,
  description: 'Early payment',
  expected_net: 100000,
  invoice_month: '2026-10',
  method: 'ACCOUNT' as const,
  owner: 'USER' as const,
  owner_id: 'owner-1',
  value: 60000,
};
const lockedRow = {
  account_id: null,
  credit_card_id: 'card-1',
  invoice_month: '2026-10',
  type: 'INCOME',
  value: 60000,
};

// endregion Mocks

// region Spies

const accountUpdateSpy = jest.fn();
const aggregateSpy = jest.fn();
const countSpy = jest.fn();
const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const findUniqueOrThrowSpy = jest.fn();
const groupBySpy = jest.fn();
const paymentFindFirstSpy = jest.fn();
const queryRawSpy = jest.fn();
const transactionSpy = jest.fn();
const updateSpy = jest.fn();

// endregion Spies

const clientMock = {
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialAccount: { update: accountUpdateSpy },
  financialInvoicePayment: { findFirst: paymentFindFirstSpy },
  financialTransaction: {
    aggregate: aggregateSpy,
    count: countSpy,
    create: createSpy,
    deleteMany: deleteManySpy,
    findUnique: findUniqueSpy,
    findUniqueOrThrow: findUniqueOrThrowSpy,
    groupBy: groupBySpy,
    update: updateSpy,
  },
};

let setup: FinanceCardCreditDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  createSpy.mockReset();
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );
  paymentFindFirstSpy.mockResolvedValue(null);
  queryRawSpy.mockResolvedValue([lockedRow]);
  findUniqueSpy.mockResolvedValue({ credit_card_id: 'card-1' });
  aggregateSpy.mockResolvedValue({ _sum: { value: 0 } });
  groupBySpy.mockResolvedValue([{ _sum: { value: 100000 }, type: 'EXPENSE' }]);

  const module = await Test.createTestingModule({
    providers: [
      FinanceCardCreditDatasource,
      { provide: Database, useValue: { client: clientMock } as unknown as Database },
    ],
  }).compile();

  setup = module.get(FinanceCardCreditDatasource);
});

const mocks = { earlyParams, lockedRow, refundParams };
const spies = {
  accountUpdate: accountUpdateSpy,
  aggregate: aggregateSpy,
  count: countSpy,
  create: createSpy,
  deleteMany: deleteManySpy,
  findUnique: findUniqueSpy,
  findUniqueOrThrow: findUniqueOrThrowSpy,
  groupBy: groupBySpy,
  paymentFindFirst: paymentFindFirstSpy,
  queryRaw: queryRawSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
