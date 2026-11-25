// Spec 123 FR 30/32: discards grouped by reason and currency (the rows the waste queries return).
export interface WasteRow {
  count: number;
  currency?: string;
  quantity: number;
  reason: string;
  valueCents: number;
}
export interface WasteSummary {
  count: number;
  mainReason: string;
  quantity: number;
  totals: { currency: string; valueCents: number }[];
}

// `null` when nothing was discarded. The main reason is the most frequent one (ties by quantity, then name).
export function summarizeWaste(rows: WasteRow[]): null | WasteSummary {
  if (rows.length === 0) {
    return null;
  }

  const byReason = new Map<string, { count: number; quantity: number }>();
  const byCurrency = new Map<string, number>();

  for (const row of rows) {
    const reason = byReason.get(row.reason) ?? { count: 0, quantity: 0 };

    byReason.set(row.reason, {
      count: reason.count + row.count,
      quantity: reason.quantity + row.quantity,
    });

    if (row.currency) {
      byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.valueCents);
    }
  }

  const [mainReason] = [...byReason.entries()].sort(
    ([nameA, a], [nameB, b]) =>
      b.count - a.count || b.quantity - a.quantity || nameA.localeCompare(nameB),
  )[0];

  return {
    count: rows.reduce((sum, row) => sum + row.count, 0),
    mainReason,
    quantity: Math.round(rows.reduce((sum, row) => sum + row.quantity, 0) * 1000) / 1000,
    totals: [...byCurrency.entries()]
      .map(([currency, valueCents]) => ({ currency, valueCents }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}
