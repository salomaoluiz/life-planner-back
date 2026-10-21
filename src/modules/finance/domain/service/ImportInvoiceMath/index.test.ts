import { computeImportedInvoices, defaultPaymentInvoiceMonth } from './index';

const card = { closingDay: 25, createdAt: new Date('2026-01-01'), dueDay: 5, limit: 1000000 };
const today = '2026-10-21';

function run(
  deltas: { earlyPaid?: number; invoiceMonth: string; net: number }[],
  existingTotals: { amount: number; earlyPaid?: number; invoiceMonth: string }[] = [],
) {
  return computeImportedInvoices({
    card,
    deltas: deltas.map((delta) => ({ earlyPaid: 0, ...delta })),
    existingTotals,
    payments: [],
    today,
  });
}

describe('computeImportedInvoices', () => {
  it('SHOULD apply refunds and discounts to the amount due', () => {
    // 1.000 of purchases, a refund of 12 and a discount of 3 in the file (net already reduced)
    const [invoice] = run([{ invoiceMonth: '2026-09', net: 100000 - 1200 - 300 }]);

    expect(invoice).toMatchObject({ amountDue: 98500, earlyOver: 0, invoiceMonth: '2026-09' });
  });

  it('SHOULD add the file to the totals the card already has', () => {
    const [invoice] = run(
      [{ invoiceMonth: '2026-09', net: -2000 }],
      [{ amount: 50000, invoiceMonth: '2026-09' }],
    );

    expect(invoice.amountDue).toBe(48000);
  });

  it('SHOULD carry a negative invoice to the next month', () => {
    const invoices = run([
      { invoiceMonth: '2026-08', net: -5000 },
      { invoiceMonth: '2026-09', net: 20000 },
    ]);

    expect(invoices.find((i) => i.invoiceMonth === '2026-08')?.amountDue).toBe(0);
    expect(invoices.find((i) => i.invoiceMonth === '2026-09')?.amountDue).toBe(15000);
  });

  it('SHOULD report how far the early payments pass the due, whatever the row order', () => {
    // due 1.000, early 600 + 500: the net holds both as credits
    const [invoice] = run([{ earlyPaid: 110000, invoiceMonth: '2026-10', net: 100000 - 110000 }]);

    expect(invoice.earlyOver).toBe(10000);
  });

  it('SHOULD not call early payments within the due over', () => {
    const [invoice] = run([{ earlyPaid: 60000, invoiceMonth: '2026-10', net: 100000 - 60000 }]);

    expect(invoice).toMatchObject({ amountDue: 40000, earlyOver: 0 });
  });

  it('SHOULD flag every cent of an early payment on an invoice already negative', () => {
    const [invoice] = run([{ earlyPaid: 3000, invoiceMonth: '2026-10', net: -1000 - 3000 }]);

    expect(invoice.earlyOver).toBe(3000);
  });

  it('SHOULD say whether the invoice is closed on a date', () => {
    const [invoice] = run([{ invoiceMonth: '2026-09', net: 100 }]);

    expect(invoice.closingDate).toBe('2026-09-25');
  });
});

describe('defaultPaymentInvoiceMonth', () => {
  it.each([
    ['2026-10-02', '2026-09'], // invoice 09 closes 09-25 and is due 10-05
    ['2026-10-05', '2026-09'], // on the due day
    ['2026-10-06', '2026-10'], // 10 is due 11-05
    ['2026-09-30', '2026-09'],
  ])('SHOULD pay the invoice due on or after %s: %s', (date, month) => {
    expect(defaultPaymentInvoiceMonth(date, card)).toBe(month);
  });
});
