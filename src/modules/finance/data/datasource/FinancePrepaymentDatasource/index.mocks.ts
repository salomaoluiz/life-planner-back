import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinancePrepaymentDatasource } from './index';

// region Mocks

const prepayParams = {
  category_id: 'cat-3',
  credit_card_id: 'card-1',
  date: new Date('2026-10-16T00:00:00.000Z'),
  discount: 12000,
  discount_description: 'Prepayment discount · Notebook',
  owner: 'USER' as const,
  owner_id: 'owner-1',
  plan_id: 'plan-1',
  target_invoice_month: '2026-10',
};
const eligibleRows = [
  { id: 'tx-4', invoice_month: '2026-11', value: 30000 },
  { id: 'tx-5', invoice_month: '2026-12', value: 30000 },
];

// endregion Mocks

// region Spies

const planFindUniqueSpy = jest.fn();
const prepaymentCreateSpy = jest.fn();
const prepaymentDeleteSpy = jest.fn();
const prepaymentFindUniqueSpy = jest.fn();
const prepaymentFindUniqueOrThrowSpy = jest.fn();
const prepaymentUpdateSpy = jest.fn();
const paymentFindFirstSpy = jest.fn();
const paymentFindManySpy = jest.fn();
const queryRawSpy = jest.fn();
const transactionCreateSpy = jest.fn();
const transactionDeleteManySpy = jest.fn();
const transactionFindManySpy = jest.fn();
const transactionSpy = jest.fn();
const transactionUpdateSpy = jest.fn();
const transactionUpdateManySpy = jest.fn();

// endregion Spies

const clientMock = {
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialInstallmentPlan: { findUnique: planFindUniqueSpy },
  financialInstallmentPrepayment: {
    create: prepaymentCreateSpy,
    delete: prepaymentDeleteSpy,
    findUnique: prepaymentFindUniqueSpy,
    findUniqueOrThrow: prepaymentFindUniqueOrThrowSpy,
    update: prepaymentUpdateSpy,
  },
  financialInvoicePayment: { findFirst: paymentFindFirstSpy, findMany: paymentFindManySpy },
  financialTransaction: {
    create: transactionCreateSpy,
    deleteMany: transactionDeleteManySpy,
    findMany: transactionFindManySpy,
    update: transactionUpdateSpy,
    updateMany: transactionUpdateManySpy,
  },
};

let setup: FinancePrepaymentDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );

  const module = await Test.createTestingModule({
    providers: [
      FinancePrepaymentDatasource,
      { provide: Database, useValue: { client: clientMock } as unknown as Database },
    ],
  }).compile();

  setup = module.get(FinancePrepaymentDatasource);
});

const mocks = { eligibleRows, prepayParams };
const spies = {
  paymentFindFirst: paymentFindFirstSpy,
  paymentFindMany: paymentFindManySpy,
  planFindUnique: planFindUniqueSpy,
  prepaymentCreate: prepaymentCreateSpy,
  prepaymentDelete: prepaymentDeleteSpy,
  prepaymentFindUnique: prepaymentFindUniqueSpy,
  prepaymentFindUniqueOrThrow: prepaymentFindUniqueOrThrowSpy,
  prepaymentUpdate: prepaymentUpdateSpy,
  queryRaw: queryRawSpy,
  transactionCreate: transactionCreateSpy,
  transactionDeleteMany: transactionDeleteManySpy,
  transactionFindMany: transactionFindManySpy,
  transactionUpdate: transactionUpdateSpy,
  transactionUpdateMany: transactionUpdateManySpy,
};

export { mocks, setup, spies };
