import { invoiceTotalsKeysOf, invoiceTotalsKeysWhere, refreshCardInvoiceTotals } from './index';
import { mocks, spies } from './index.mocks';

function sqlOf(): { strings: string; values: unknown[] } {
  const sql = spies.executeRaw.mock.calls[0][0] as { strings: string[]; values: unknown[] };

  return { strings: sql.strings.join('?'), values: sql.values };
}

describe('invoiceTotalsKeysOf (spec 090)', () => {
  it('SHOULD keep only card rows with an invoice month, once each, ordered by card then month', () => {
    expect(
      invoiceTotalsKeysOf([
        { credit_card_id: 'card-b', invoice_month: '2026-02' },
        { credit_card_id: 'card-a', invoice_month: '2026-03' },
        { credit_card_id: 'card-a', invoice_month: '2026-01' },
        { credit_card_id: 'card-a', invoice_month: '2026-03' },
        { credit_card_id: null, invoice_month: null },
        { credit_card_id: 'card-a', invoice_month: null },
        {},
      ]),
    ).toEqual([
      { creditCardId: 'card-a', invoiceMonth: '2026-01' },
      { creditCardId: 'card-a', invoiceMonth: '2026-03' },
      { creditCardId: 'card-b', invoiceMonth: '2026-02' },
    ]);
  });
});

describe('invoiceTotalsKeysWhere (spec 090)', () => {
  it('SHOULD read the distinct pairs of the card rows that match', async () => {
    spies.findMany.mockResolvedValue([{ credit_card_id: 'card-a', invoice_month: '2026-01' }]);

    await expect(invoiceTotalsKeysWhere(mocks.tx, { recurrence_id: 'r-1' })).resolves.toEqual([
      { creditCardId: 'card-a', invoiceMonth: '2026-01' },
    ]);
    expect(spies.findMany).toHaveBeenCalledWith({
      distinct: ['credit_card_id', 'invoice_month'],
      select: { credit_card_id: true, invoice_month: true },
      where: { AND: [{ recurrence_id: 'r-1' }, { credit_card_id: { not: null } }] },
    });
  });
});

describe('refreshCardInvoiceTotals (spec 090)', () => {
  it('SHOULD NOT run a statement for no pairs', async () => {
    await refreshCardInvoiceTotals(mocks.tx, []);

    expect(spies.executeRaw).not.toHaveBeenCalled();
  });

  it('SHOULD recompute every distinct pair in ONE statement with bound parameters', async () => {
    await refreshCardInvoiceTotals(mocks.tx, [
      { creditCardId: 'card-b', invoiceMonth: '2026-02' },
      { creditCardId: 'card-a', invoiceMonth: '2026-01' },
      { creditCardId: 'card-a', invoiceMonth: '2026-01' },
    ]);

    const { strings, values } = sqlOf();

    expect(spies.executeRaw).toHaveBeenCalledTimes(1);
    expect(values).toEqual([
      'card-a',
      '2026-01',
      'card-b',
      '2026-02',
      '00000000-0000-4000-8000-000000000005',
    ]);
    expect(strings).toContain('INSERT INTO "financial_card_invoice_totals"');
    expect(strings).toContain('ON CONFLICT ("credit_card_id", "invoice_month") DO UPDATE');
    expect(strings).toContain('DELETE FROM "financial_card_invoice_totals"');
    expect(strings).not.toContain('card-a');
  });
  it('SHOULD split effective and projected rows (spec 096)', async () => {
    await refreshCardInvoiceTotals(mocks.tx, [{ creditCardId: 'card-a', invoiceMonth: '2026-01' }]);

    const { strings } = sqlOf();

    expect(strings).toContain('FILTER (WHERE t."type" = \'EXPENSE\' AND NOT t."projected")');
    expect(strings).toContain('FILTER (WHERE t."type" = \'INCOME\' AND NOT t."projected")');
    expect(strings).toContain('FILTER (WHERE t."projected")');
    expect(strings).toContain('"projected_amount"');
    expect(strings).toContain('"projected_count"');
  });

  it('SHOULD keep the row while only projected rows remain and delete it at zero rows (spec 096)', async () => {
    await refreshCardInvoiceTotals(mocks.tx, [{ creditCardId: 'card-a', invoiceMonth: '2026-01' }]);

    const { strings } = sqlOf();

    expect(strings).toContain('a."purchase_count" + a."projected_count" = 0');
    expect(strings).toContain('a."purchase_count" + a."projected_count" > 0');
  });
});
