import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinanceInstallmentPlanDatasource } from './index';

// region Spies

const paymentFindFirstSpy = jest.fn();
const planCreateSpy = jest.fn();
const planDeleteSpy = jest.fn();
const planFindUniqueSpy = jest.fn();
const planUpdateSpy = jest.fn();
const prepaymentDeleteSpy = jest.fn();
const prepaymentFindUniqueSpy = jest.fn();
const prepaymentUpdateSpy = jest.fn();
const queryRawSpy = jest.fn();
const rowCreateManySpy = jest.fn();
const rowDeleteManySpy = jest.fn();
const rowFindManySpy = jest.fn();
const rowUpdateManySpy = jest.fn();
const transactionSpy = jest.fn();

// endregion Spies

const clientMock = {
  $queryRaw: queryRawSpy,
  $transaction: transactionSpy,
  financialInstallmentPlan: {
    create: planCreateSpy,
    delete: planDeleteSpy,
    findUnique: planFindUniqueSpy,
    update: planUpdateSpy,
  },
  financialInstallmentPrepayment: {
    delete: prepaymentDeleteSpy,
    findUnique: prepaymentFindUniqueSpy,
    update: prepaymentUpdateSpy,
  },
  financialInvoicePayment: { findFirst: paymentFindFirstSpy },
  financialTransaction: {
    createMany: rowCreateManySpy,
    deleteMany: rowDeleteManySpy,
    findMany: rowFindManySpy,
    updateMany: rowUpdateManySpy,
  },
};

let setup: FinanceInstallmentPlanDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );
  paymentFindFirstSpy.mockResolvedValue(null);
  prepaymentFindUniqueSpy.mockResolvedValue(null);
  planFindUniqueSpy.mockResolvedValue({ credit_card_id: 'card-1' });
  rowFindManySpy.mockResolvedValue([{ invoice_month: '2026-10' }, { invoice_month: '2026-11' }]);

  const module = await Test.createTestingModule({
    providers: [
      FinanceInstallmentPlanDatasource,
      { provide: Database, useValue: { client: clientMock } as unknown as Database },
    ],
  }).compile();

  setup = module.get(FinanceInstallmentPlanDatasource);
});

const mocks = {
  rows: [
    { invoice_month: '2026-10', value: 3334 },
    { invoice_month: '2026-11', value: 3333 },
    { invoice_month: '2026-12', value: 3333 },
  ],
};
const spies = {
  paymentFindFirst: paymentFindFirstSpy,
  planCreate: planCreateSpy,
  planDelete: planDeleteSpy,
  planFindUnique: planFindUniqueSpy,
  planUpdate: planUpdateSpy,
  prepaymentDelete: prepaymentDeleteSpy,
  prepaymentFindUnique: prepaymentFindUniqueSpy,
  prepaymentUpdate: prepaymentUpdateSpy,
  queryRaw: queryRawSpy,
  rowCreateMany: rowCreateManySpy,
  rowDeleteMany: rowDeleteManySpy,
  rowFindMany: rowFindManySpy,
  rowUpdateMany: rowUpdateManySpy,
  transaction: transactionSpy,
};

export { mocks, setup, spies };
