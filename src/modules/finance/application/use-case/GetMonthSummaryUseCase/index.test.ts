import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { InvoiceStatus, TransactionType } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

const { EXPENSE, INCOME } = TransactionType;

it('SHOULD sum income, expense, toPay and toReceive over the account rows', async () => {
  const result = await setup.execute({
    accountRows: [
      mocks.row(INCOME, 1000, true),
      mocks.row(INCOME, 500, false),
      mocks.row(EXPENSE, 300, true),
      mocks.row(EXPENSE, 200, false),
    ],
    currency: 'BRL',
    invoices: [],
    month: mocks.month,
    projections: [],
  });

  expect(result).toEqual({
    currency: 'BRL',
    expense: 500,
    income: 1500,
    projectedExpense: 0,
    projectedIncome: 0,
    toPay: 200,
    toReceive: 500,
  });
});

it('SHOULD skip rows whose category is excluded from the totals AND card rows', async () => {
  const excluded = new TransactionEntityFixture()
    .withDate('2026-11-10')
    .withBalanceAdjustment()
    .build();
  const card = new TransactionEntityFixture()
    .withDate('2026-11-10')
    .withCard('card', '2026-11')
    .build();

  const result = await setup.execute({
    accountRows: [excluded, card],
    currency: 'BRL',
    invoices: [],
    month: mocks.month,
    projections: [],
  });

  expect(result.expense + result.income).toBe(0);
});

it('SHOULD add the invoice amount and early payments to the expense AND the amount due to toPay unless it is paid', async () => {
  const result = await setup.execute({
    accountRows: [],
    currency: 'BRL',
    invoices: [
      mocks.invoice(900, 900, 100, InvoiceStatus.CLOSED),
      mocks.invoice(400, 0, 0, InvoiceStatus.PAID),
    ],
    month: mocks.month,
    projections: [],
  });

  expect(result.expense).toBe(1400);
  expect(result.toPay).toBe(900);
});

it('SHOULD split the projections: account ones by date, card ones by the invoice list date', async () => {
  const result = await setup.execute({
    accountRows: [],
    currency: 'BRL',
    invoices: [],
    month: mocks.month,
    projections: [
      mocks.projection({ type: INCOME, value: 700 }),
      mocks.projection({ value: 100 }),
      mocks.projection({ date: '2026-12-01', value: 50 }),
      mocks.projection({
        creditCard: { color: '#000000', id: 'card', title: 'Card' },
        invoiceListDate: '2026-11-20',
        value: 300,
      }),
      mocks.projection({
        creditCard: { color: '#000000', id: 'card', title: 'Card' },
        invoiceListDate: '2026-12-20',
        value: 999,
      }),
    ],
  });

  expect(result.projectedIncome).toBe(700);
  expect(result.projectedExpense).toBe(400);
  expect(result.income).toBe(0);
});

it('SHOULD leave the projected transfer sides out of the totals (spec 098)', async () => {
  const excluded = { ...mocks.projection({ value: 500 }).category, excludeFromTotals: true };
  const result = await setup.execute({
    accountRows: [],
    currency: 'BRL',
    invoices: [],
    month: mocks.month,
    projections: [
      { ...mocks.projection({ value: 500 }), category: excluded },
      { ...mocks.projection({ type: INCOME, value: 500 }), category: excluded },
    ],
  });

  expect(result.projectedExpense).toBe(0);
  expect(result.projectedIncome).toBe(0);
});

it('SHOULD count only the matching purchases of a filtered invoice', async () => {
  const result = await setup.execute({
    accountRows: [],
    currency: 'BRL',
    invoices: [
      { ...mocks.invoice(900, 900, 0, InvoiceStatus.CLOSED), filtered: { filteredTotal: 250 } },
      { ...mocks.invoice(400, 0, 0, InvoiceStatus.PAID), filtered: { filteredTotal: 100 } },
    ],
    month: mocks.month,
    projections: [],
  });

  expect(result.expense).toBe(350);
  expect(result.toPay).toBe(250);
});

it('SHOULD return the currency it was given (spec 103)', async () => {
  const result = await setup.execute({
    accountRows: [],
    currency: 'USD',
    invoices: [],
    month: mocks.month,
    projections: [],
  });

  expect(result.currency).toBe('USD');
});
