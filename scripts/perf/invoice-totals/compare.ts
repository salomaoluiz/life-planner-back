// Spec 090: the stored totals of `financial_card_invoice_totals` against the aggregation of `sumCardInvoices`.
export interface InvoiceTotalsRow {
  creditCardId: string;
  earlyPaid: number;
  expense: number;
  income: number;
  invoiceMonth: string;
  purchaseCount: number;
}

const FIELDS = ['income', 'expense', 'earlyPaid', 'purchaseCount'] as const;

// One line per pair that is missing on one side or differs on a field; empty = in sync.
export function compareInvoiceTotals(
  stored: InvoiceTotalsRow[],
  computed: InvoiceTotalsRow[],
): string[] {
  const keyOf = (row: InvoiceTotalsRow): string => `${row.creditCardId}|${row.invoiceMonth}`;
  const storedByKey = new Map(stored.map((row) => [keyOf(row), row]));
  const computedByKey = new Map(computed.map((row) => [keyOf(row), row]));
  const keys = [...new Set([...storedByKey.keys(), ...computedByKey.keys()])].sort();
  const mismatches: string[] = [];

  for (const key of keys) {
    const have = storedByKey.get(key);
    const want = computedByKey.get(key);

    if (!have) {
      mismatches.push(`${key}: missing from the stored totals`);
    } else if (!want) {
      mismatches.push(`${key}: stored but the card has no rows in that invoice`);
    } else {
      const diffs = FIELDS.filter((field) => have[field] !== want[field]).map(
        (field) => `${field} stored ${have[field]} expected ${want[field]}`,
      );

      if (diffs.length > 0) {
        mismatches.push(`${key}: ${diffs.join(', ')}`);
      }
    }
  }

  return mismatches;
}
