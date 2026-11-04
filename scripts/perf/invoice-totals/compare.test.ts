import { compareInvoiceTotals, InvoiceTotalsRow } from './compare';

const row = (over: Partial<InvoiceTotalsRow> = {}): InvoiceTotalsRow => ({
  creditCardId: 'card-1',
  earlyPaid: 0,
  expense: 1000,
  income: 0,
  invoiceMonth: '2026-01',
  purchaseCount: 1,
  ...over,
});

describe('compareInvoiceTotals (spec 090)', () => {
  it('SHOULD report nothing when both sides match', () => {
    expect(compareInvoiceTotals([row()], [row()])).toEqual([]);
  });

  it('SHOULD report a pair missing from the stored totals', () => {
    expect(compareInvoiceTotals([], [row()])).toEqual([
      'card-1|2026-01: missing from the stored totals',
    ]);
  });

  it('SHOULD report a stored pair without rows', () => {
    expect(compareInvoiceTotals([row()], [])).toEqual([
      'card-1|2026-01: stored but the card has no rows in that invoice',
    ]);
  });

  it('SHOULD report every field that differs', () => {
    expect(compareInvoiceTotals([row({ expense: 900, purchaseCount: 2 })], [row()])).toEqual([
      'card-1|2026-01: expense stored 900 expected 1000, purchaseCount stored 2 expected 1',
    ]);
  });
});
