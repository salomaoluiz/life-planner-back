import { CardRowItem, evaluateCardRows } from './index';

const card = {
  closingDay: 25,
  createdAt: new Date('2026-01-01'),
  dueDay: 5,
  id: 'card-1',
  limit: 1,
};
const today = '2026-10-21';

function item(
  line: number,
  kind: CardRowItem['kind'],
  value: number,
  invoiceMonth: string,
  date = '2026-10-02',
): CardRowItem {
  return {
    card: card as unknown as CardRowItem['card'],
    date,
    invoiceMonth,
    kind,
    line,
    value,
  };
}
function run(
  items: CardRowItem[],
  existing: { payments?: { amount: number; month: string }[] } = {},
) {
  return evaluateCardRows({
    data: [
      {
        card: card as never,
        invoices: undefined as never,
        payments: (existing.payments ?? []).map((payment) => ({
          accountId: null,
          accountName: null,
          amount: payment.amount,
          method: 'EXTERNAL' as never,
          paidOn: '2026-10-01',
          referenceMonth: payment.month,
        })),
        totals: [],
      },
    ],
    duplicateLines: new Set<number>(),
    items,
    today,
  });
}

describe('evaluateCardRows', () => {
  it('SHOULD accept a payment that equals the invoice after the credits of the same file', () => {
    const result = run([
      item(2, 'CARD_PURCHASE', 100000, '2026-09'),
      item(3, 'REFUND', 1200, '2026-09'),
      item(4, 'PREPAYMENT_DISCOUNT', 300, '2026-09'),
      item(5, 'INVOICE_PAYMENT', 98500, '2026-09'),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.invoices).toEqual([
      { amountDue: 98500, creditCardId: 'card-1', invoiceMonth: '2026-09', paid: true },
    ]);
  });

  it('SHOULD refuse a payment off by one cent with the due and the value', () => {
    const result = run([
      item(2, 'CARD_PURCHASE', 100000, '2026-09'),
      item(5, 'INVOICE_PAYMENT', 100001, '2026-09'),
    ]);

    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'INVOICE_PAYMENT_MISMATCH',
        line: 5,
        params: { due: 100000, month: '2026-09', value: 100001 },
      }),
    ]);
  });

  it('SHOULD refuse a payment for an invoice that credits brought to zero', () => {
    const result = run([
      item(2, 'CARD_PURCHASE', 1000, '2026-09'),
      item(3, 'REFUND', 1000, '2026-09'),
      item(4, 'INVOICE_PAYMENT', 1000, '2026-09'),
    ]);

    expect(result.errors.map((error) => error.code)).toEqual(['INVOICE_PAYMENT_MISMATCH']);
  });

  it('SHOULD flag every early payment of an invoice that passes the due, in any row order', () => {
    const result = run([
      item(3, 'EARLY_PAYMENT', 50000, '2026-10', '2026-10-16'),
      item(2, 'CARD_PURCHASE', 100000, '2026-10'),
      item(4, 'EARLY_PAYMENT', 60000, '2026-10', '2026-10-17'),
    ]);

    expect(result.errors.map((error) => [error.code, error.line])).toEqual([
      ['EARLY_PAYMENT_OVER_DUE', 3],
      ['EARLY_PAYMENT_OVER_DUE', 4],
    ]);
    expect(result.errors[0].params).toEqual({ month: '2026-10', value: 10000 });
  });

  it('SHOULD accept early payments within the due', () => {
    const result = run([
      item(2, 'CARD_PURCHASE', 100000, '2026-10'),
      item(3, 'EARLY_PAYMENT', 60000, '2026-10', '2026-10-16'),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.invoices[0].amountDue).toBe(40000);
  });

  it('SHOULD refuse credits and early payments on an invoice paid in the database', () => {
    const result = run(
      [item(2, 'REFUND', 100, '2026-09'), item(3, 'EARLY_PAYMENT', 100, '2026-09')],
      { payments: [{ amount: 5000, month: '2026-09' }] },
    );

    expect(result.errors.map((error) => error.code)).toEqual(['INVOICE_PAID', 'INVOICE_PAID']);
  });

  it('SHOULD say INVOICE_ALREADY_PAID for a payment of a paid invoice, or a duplicate WHEN the amount is the same', () => {
    const different = run([item(2, 'INVOICE_PAYMENT', 4000, '2026-09')], {
      payments: [{ amount: 5000, month: '2026-09' }],
    });
    const same = run([item(2, 'INVOICE_PAYMENT', 5000, '2026-09')], {
      payments: [{ amount: 5000, month: '2026-09' }],
    });

    expect(different.errors.map((error) => error.code)).toEqual(['INVOICE_ALREADY_PAID']);
    expect(same.errors).toEqual([]);
    expect(same.duplicateLines).toEqual([2]);
  });

  it('SHOULD flag two payments of the same invoice in the file', () => {
    const result = run([
      item(2, 'CARD_PURCHASE', 1000, '2026-09'),
      item(3, 'INVOICE_PAYMENT', 1000, '2026-09'),
      item(4, 'INVOICE_PAYMENT', 1000, '2026-09'),
    ]);

    expect(result.errors.map((error) => [error.code, error.line])).toEqual([
      ['DUPLICATE_INVOICE_PAYMENT', 3],
      ['DUPLICATE_INVOICE_PAYMENT', 4],
    ]);
  });

  it('SHOULD refuse a payment dated before the invoice closes', () => {
    const result = run([
      item(2, 'CARD_PURCHASE', 1000, '2026-10'),
      item(3, 'INVOICE_PAYMENT', 1000, '2026-10', '2026-10-20'),
    ]);

    expect(result.errors.map((error) => error.code)).toEqual(['INVOICE_NOT_CLOSED']);
  });

  it('SHOULD leave the rows already flagged as duplicates out of the math', () => {
    const result = evaluateCardRows({
      data: [{ card: card as never, invoices: undefined as never, payments: [], totals: [] }],
      duplicateLines: new Set([3]),
      items: [
        item(2, 'CARD_PURCHASE', 100000, '2026-10'),
        item(3, 'EARLY_PAYMENT', 100000, '2026-10', '2026-10-16'),
        item(4, 'EARLY_PAYMENT', 100000, '2026-10', '2026-10-17'),
      ],
      today,
    });

    expect(result.errors).toEqual([]);
  });

  it('SHOULD carry a negative invoice into the next one', () => {
    const result = run([
      item(2, 'CARD_PURCHASE', 20000, '2026-09'),
      item(3, 'REFUND', 25000, '2026-09'),
      item(4, 'CARD_PURCHASE', 30000, '2026-10'),
      item(5, 'INVOICE_PAYMENT', 25000, '2026-10', '2026-11-02'),
    ]);

    expect(result.errors).toEqual([]);
  });
});
