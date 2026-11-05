import { compareInvoiceTotals, InvoiceTotalsRow } from './compare';

const row = (over: Partial<InvoiceTotalsRow> = {}): InvoiceTotalsRow => ({
  creditCardId: 'card-1',
  earlyPaid: 0,
  expense: 1000,
  income: 0,
  invoiceMonth: '2026-01',
  projectedAmount: 0,
  projectedCount: 0,
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

  it('SHOULD report the projected fields too (spec 096)', () => {
    expect(
      compareInvoiceTotals([row({ projectedAmount: 100, projectedCount: 1 })], [row()]),
    ).toEqual([
      'card-1|2026-01: projectedAmount stored 100 expected 0, projectedCount stored 1 expected 0',
    ]);
  });
});
