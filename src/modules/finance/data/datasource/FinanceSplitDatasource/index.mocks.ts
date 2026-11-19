import { Test } from '@nestjs/testing';

import { WriteSplitDatasourceParams } from '@finance/data/repository/datasource/IFinanceSplitDatasource';
import { TransactionType } from '@finance/domain/enum';
import { Database } from '@shared/infra/db/Database';

import { FinanceSplitDatasource } from './index';

// region Mocks

const writeParams: WriteSplitDatasourceParams = {
  account_id: 'acc-1',
  created_by: 'user-1',
  credit_card_id: null,
  currency: 'BRL',
  date: new Date('2026-11-15T00:00:00.000Z'),
  description: 'Mercado',
  invoice_month: null,
  notes: 'Compra do mês',
  occurrence_number: null,
  owner: 'USER',
  owner_id: 'user-1',
  paid: true,
  parts: [
    { category_id: 'cat-1', description: null, type: TransactionType.EXPENSE, value: 12000 },
    {
      category_id: 'cat-2',
      description: 'Detergente',
      tag_names: ['casa'],
      type: TransactionType.EXPENSE,
      value: 5000,
    },
    { category_id: 'cat-adj', description: null, type: TransactionType.EXPENSE, value: -440 },
  ],
  recurrence_id: null,
};
const header = { created_at: new Date('2026-11-15T10:00:00.000Z'), id: 'split-1' };
function scalars(id: string, value: number, overrides: Record<string, unknown> = {}) {
  return {
    account_id: 'acc-1',
    credit_card_id: null,
    id,
    invoice_month: null,
    paid: true,
    type: 'EXPENSE',
    value,
    ...overrides,
  };
}
const splitRecord = { ...header, description: 'Mercado', transactions: [] };

// endregion Mocks

// region Spies

const accountUpdateSpy = jest.fn();
const invoicePaymentFindFirstSpy = jest.fn();
const queryRawSpy = jest.fn();
const splitCreateSpy = jest.fn();
const splitDeleteSpy = jest.fn();
const splitFindManySpy = jest.fn();
const splitFindUniqueSpy = jest.fn();
const splitFindUniqueOrThrowSpy = jest.fn();
const splitUpdateSpy = jest.fn();
const transactionCreateSpy = jest.fn();
const transactionDeleteSpy = jest.fn();
const transactionDeleteManySpy = jest.fn();
const transactionFindManySpy = jest.fn();
const transactionFindUniqueSpy = jest.fn();
const transactionUpdateSpy = jest.fn();
const transactionUpdateManySpy = jest.fn();
const transactionSpy = jest.fn();

// endregion Spies

const clientMock = {
  $executeRaw: jest.fn(),
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialAccount: { update: accountUpdateSpy },
  financialInvoicePayment: { findFirst: invoicePaymentFindFirstSpy },
  financialSplit: {
    create: splitCreateSpy,
    delete: splitDeleteSpy,
    findMany: splitFindManySpy,
    findUnique: splitFindUniqueSpy,
    findUniqueOrThrow: splitFindUniqueOrThrowSpy,
    update: splitUpdateSpy,
  },
  financialTransaction: {
    create: transactionCreateSpy,
    delete: transactionDeleteSpy,
    deleteMany: transactionDeleteManySpy,
    findMany: transactionFindManySpy,
    findUnique: transactionFindUniqueSpy,
    update: transactionUpdateSpy,
    updateMany: transactionUpdateManySpy,
  },
};

let setup: FinanceSplitDatasource;

beforeEach(async () => {
  jest.resetAllMocks();
  invoicePaymentFindFirstSpy.mockResolvedValue(null);
  splitCreateSpy.mockResolvedValue(header);
  splitFindUniqueOrThrowSpy.mockResolvedValue(splitRecord);
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );

  const module = await Test.createTestingModule({
    providers: [
      FinanceSplitDatasource,
      { provide: Database, useValue: { client: clientMock } as unknown as Database },
    ],
  }).compile();

  setup = module.get<FinanceSplitDatasource>(FinanceSplitDatasource);
});

const mocks = { header, scalars, splitRecord, writeParams };
const spies = {
  accountUpdate: accountUpdateSpy,
  invoicePaymentFindFirst: invoicePaymentFindFirstSpy,
  queryRaw: queryRawSpy,
  splitCreate: splitCreateSpy,
  splitDelete: splitDeleteSpy,
  splitFindMany: splitFindManySpy,
  splitFindUnique: splitFindUniqueSpy,
  splitFindUniqueOrThrow: splitFindUniqueOrThrowSpy,
  splitUpdate: splitUpdateSpy,
  transactionCreate: transactionCreateSpy,
  transactionDelete: transactionDeleteSpy,
  transactionDeleteMany: transactionDeleteManySpy,
  transactionFindMany: transactionFindManySpy,
  transactionFindUnique: transactionFindUniqueSpy,
  transactionUpdate: transactionUpdateSpy,
  transactionUpdateMany: transactionUpdateManySpy,
};

export { mocks, setup, spies };
