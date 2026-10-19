import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { FinanceOwnerDataDatasource } from './index';

// region Spies

const accountDeleteManySpy = jest.fn();
const categoryDeleteManySpy = jest.fn();
const creditCardDeleteManySpy = jest.fn();
const paymentDeleteManySpy = jest.fn();
const planDeleteManySpy = jest.fn();
const recurrenceDeleteManySpy = jest.fn();
const prepaymentDeleteManySpy = jest.fn();
const prepaymentUpdateManySpy = jest.fn();
const transactionDeleteManySpy = jest.fn();
const transactionSpy = jest.fn();

// endregion Spies

const clientMock = {
  $transaction: transactionSpy,
  financialAccount: { deleteMany: accountDeleteManySpy },
  financialCategory: { deleteMany: categoryDeleteManySpy },
  financialCreditCard: { deleteMany: creditCardDeleteManySpy },
  financialInstallmentPlan: { deleteMany: planDeleteManySpy },
  financialInstallmentPrepayment: {
    deleteMany: prepaymentDeleteManySpy,
    updateMany: prepaymentUpdateManySpy,
  },
  financialInvoicePayment: { deleteMany: paymentDeleteManySpy },
  financialRecurrence: { deleteMany: recurrenceDeleteManySpy },
  financialTransaction: { deleteMany: transactionDeleteManySpy },
};
const databaseMock = { client: clientMock } as unknown as Database;

let setup: FinanceOwnerDataDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionSpy.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(clientMock),
  );
  [
    accountDeleteManySpy,
    categoryDeleteManySpy,
    creditCardDeleteManySpy,
    paymentDeleteManySpy,
    planDeleteManySpy,
    prepaymentDeleteManySpy,
    prepaymentUpdateManySpy,
    recurrenceDeleteManySpy,
    transactionDeleteManySpy,
  ].forEach((spy) => {
    spy.mockReset();
    spy.mockResolvedValue({ count: 0 });
  });

  const module = await Test.createTestingModule({
    providers: [FinanceOwnerDataDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(FinanceOwnerDataDatasource);
});

const mocks = {};
const spies = {
  accountDeleteMany: accountDeleteManySpy,
  categoryDeleteMany: categoryDeleteManySpy,
  creditCardDeleteMany: creditCardDeleteManySpy,
  paymentDeleteMany: paymentDeleteManySpy,
  planDeleteMany: planDeleteManySpy,
  prepaymentDeleteMany: prepaymentDeleteManySpy,
  prepaymentUpdateMany: prepaymentUpdateManySpy,
  recurrenceDeleteMany: recurrenceDeleteManySpy,
  transaction: transactionSpy,
  transactionDeleteMany: transactionDeleteManySpy,
};

export { mocks, setup, spies };
