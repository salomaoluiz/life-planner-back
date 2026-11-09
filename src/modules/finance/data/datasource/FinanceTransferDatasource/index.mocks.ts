import { Test } from '@nestjs/testing';

import { WriteTransferDatasourceParams } from '@finance/data/repository/datasource/IFinanceTransferDatasource';
import { Database } from '@shared/infra/db/Database';

import { FinanceTransferDatasource } from './index';

// region Mocks

const writeParams: WriteTransferDatasourceParams = {
  amount_in: 92000,
  amount_out: 500000,
  created_by: 'user-1',
  date_in: new Date('2026-11-06T00:00:00.000Z'),
  date_out: new Date('2026-11-04T00:00:00.000Z'),
  description: 'Send to USD account',
  fee: 350,
  from: { account_id: 'acc-b', currency: 'BRL', owner: 'USER', owner_id: 'user-1' },
  notes: null,
  occurrence_number: null,
  paid: true,
  recurrence_id: null,
  to: { account_id: 'acc-a', currency: 'USD', owner: 'FAMILY', owner_id: 'family-1' },
};
const transferRecord = {
  amount_in: 92000,
  amount_out: 500000,
  created_at: new Date('2026-11-04T10:00:00.000Z'),
  created_by: 'user-1',
  currency_in: 'USD',
  currency_out: 'BRL',
  date_in: new Date('2026-11-06T00:00:00.000Z'),
  date_out: new Date('2026-11-04T00:00:00.000Z'),
  description: 'Send to USD account',
  fee: 350,
  from_account_id: 'acc-b',
  id: 'transfer-1',
  notes: null,
  occurrence_number: null,
  paid: true,
  recurrence_id: null,
  to_account_id: 'acc-a',
  transactions: [
    { category_id: '00000000-0000-4000-8000-000000000006', id: 'row-out' },
    { category_id: '00000000-0000-4000-8000-000000000007', id: 'row-in' },
    { category_id: '00000000-0000-4000-8000-000000000008', id: 'row-fee' },
  ],
  updated_at: new Date('2026-11-04T10:00:00.000Z'),
};

// endregion Mocks

// region Spies

const accountFindManySpy = jest.fn();
const accountUpdateSpy = jest.fn();
const recurrenceCreateSpy = jest.fn();
const recurrenceDeleteSpy = jest.fn();
const recurrenceUpdateSpy = jest.fn();
const queryRawSpy = jest.fn();
const transactionCreateSpy = jest.fn();
const transactionDeleteSpy = jest.fn();
const transactionDeleteManySpy = jest.fn();
const transactionUpdateSpy = jest.fn();
const transferCreateSpy = jest.fn();
const transferDeleteManySpy = jest.fn();
const transferDeleteSpy = jest.fn();
const transferFindFirstSpy = jest.fn();
const transferFindManySpy = jest.fn();
const transferFindUniqueSpy = jest.fn();
const transferFindUniqueOrThrowSpy = jest.fn();
const transferUpdateSpy = jest.fn();
const transactionSpy = jest.fn();

// endregion Spies

const clientMock = {
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialAccount: { findMany: accountFindManySpy, update: accountUpdateSpy },
  financialRecurrence: {
    create: recurrenceCreateSpy,
    delete: recurrenceDeleteSpy,
    update: recurrenceUpdateSpy,
  },
  financialTransaction: {
    create: transactionCreateSpy,
    delete: transactionDeleteSpy,
    deleteMany: transactionDeleteManySpy,
    update: transactionUpdateSpy,
  },
  financialTransfer: {
    create: transferCreateSpy,
    delete: transferDeleteSpy,
    deleteMany: transferDeleteManySpy,
    findFirst: transferFindFirstSpy,
    findMany: transferFindManySpy,
    findUnique: transferFindUniqueSpy,
    findUniqueOrThrow: transferFindUniqueOrThrowSpy,
    update: transferUpdateSpy,
  },
};

let setup: FinanceTransferDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transferFindUniqueOrThrowSpy.mockResolvedValue(transferRecord);
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );

  const module = await Test.createTestingModule({
    providers: [
      FinanceTransferDatasource,
      { provide: Database, useValue: { client: clientMock } as unknown as Database },
    ],
  }).compile();

  setup = module.get<FinanceTransferDatasource>(FinanceTransferDatasource);
});

const mocks = { transferRecord, writeParams };
const spies = {
  accountFindMany: accountFindManySpy,
  accountUpdate: accountUpdateSpy,
  queryRaw: queryRawSpy,
  recurrenceCreate: recurrenceCreateSpy,
  recurrenceDelete: recurrenceDeleteSpy,
  recurrenceUpdate: recurrenceUpdateSpy,
  transactionCreate: transactionCreateSpy,
  transactionDelete: transactionDeleteSpy,
  transactionDeleteMany: transactionDeleteManySpy,
  transactionUpdate: transactionUpdateSpy,
  transferCreate: transferCreateSpy,
  transferDelete: transferDeleteSpy,
  transferDeleteMany: transferDeleteManySpy,
  transferFindFirst: transferFindFirstSpy,
  transferFindMany: transferFindManySpy,
  transferFindUnique: transferFindUniqueSpy,
  transferFindUniqueOrThrow: transferFindUniqueOrThrowSpy,
  transferUpdate: transferUpdateSpy,
};

export { mocks, setup, spies };
