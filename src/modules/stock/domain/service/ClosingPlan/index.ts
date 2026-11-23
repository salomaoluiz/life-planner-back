export type ClosingErrorCode =
  | 'PURCHASE_DEFAULT_FINANCE_CATEGORY_REQUIRED'
  | 'PURCHASE_PRICE_REQUIRED'
  | 'PURCHASE_RECEIPT_TOTAL_REQUIRED'
  | 'PURCHASE_TOTAL_BELOW_ITEMS';

// A closing rule broken; the application layer turns it into a 422 carrying `code`.
export interface ClosingPart {
  categoryId?: string;
  kind: ClosingPartKind;
  // Negative only for the ADJUSTMENT (a discount, P7).
  valueCents: number;
}
export type ClosingPartKind = 'ADJUSTMENT' | 'CATEGORY' | 'NO_PRICE';
export interface ClosingPlan {
  parts: ClosingPart[];
  rows: { filledByDifference: boolean; id: string; lineTotalCents?: number }[];
}
export interface ClosingRow {
  // The finance category of the row's item (`effectiveFinanceCategoryId`), when it has one.
  financeCategoryId?: string;
  id: string;
  lineTotalCents?: number;
  // "Não sei" (FR 28): the row stays without a price and shares the rest of the receipt.
  unknownPrice?: boolean;
}

export class ClosingError extends Error {
  constructor(
    readonly code: ClosingErrorCode,
    message: string,
  ) {
    super(message);
  }
}

// Spec 120 FR 28 and 35: fills the prices from the receipt total and builds the finance parts.
export function planClosing(input: {
  defaultFinanceCategoryId?: string;
  receiptTotalCents?: number;
  rows: ClosingRow[];
}): ClosingPlan {
  const { receiptTotalCents } = input;

  if (!receiptTotalCents || receiptTotalCents <= 0) {
    throw new ClosingError('PURCHASE_RECEIPT_TOTAL_REQUIRED', 'The receipt total is required');
  }

  const priced = input.rows.filter((row) => row.lineTotalCents !== undefined);
  const pricedSum = priced.reduce((sum, row) => sum + (row.lineTotalCents ?? 0), 0);
  const missing = input.rows.filter((row) => row.lineTotalCents === undefined);
  const unknown = missing.filter((row) => row.unknownPrice);
  const unmarked = missing.filter((row) => !row.unknownPrice);
  const rest = receiptTotalCents - pricedSum;
  const filled = new Map<string, number>();
  let adjustment = 0;
  let noPrice = 0;

  if (missing.length === 1 && unmarked.length === 1) {
    // Exactly one row without price receives what is left of the receipt.
    if (rest <= 0) {
      throw new ClosingError(
        'PURCHASE_PRICE_REQUIRED',
        'The receipt total leaves nothing for the row without a price',
      );
    }
    filled.set(unmarked[0].id, rest);
  } else if (missing.length > 0) {
    if (unmarked.length > 0) {
      throw new ClosingError('PURCHASE_PRICE_REQUIRED', 'Every row needs a price or "unknown"');
    }
    if (rest < 0) {
      throw new ClosingError(
        'PURCHASE_TOTAL_BELOW_ITEMS',
        'The receipt total is below the sum of the priced items',
      );
    }
    noPrice = rest;
  } else {
    adjustment = rest;
  }

  function requireCategory(categoryId?: string): string {
    const resolved = categoryId ?? input.defaultFinanceCategoryId;

    if (!resolved) {
      throw new ClosingError(
        'PURCHASE_DEFAULT_FINANCE_CATEGORY_REQUIRED',
        'Choose the finance category of the list',
      );
    }

    return resolved;
  }
  const byCategory = new Map<string, number>();

  for (const row of input.rows) {
    const value = row.lineTotalCents ?? filled.get(row.id);

    if (value !== undefined) {
      const category = requireCategory(row.financeCategoryId);

      byCategory.set(category, (byCategory.get(category) ?? 0) + value);
    }
  }

  const parts: ClosingPart[] = [...byCategory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([categoryId, valueCents]) => ({ categoryId, kind: 'CATEGORY', valueCents }));

  if (unknown.length > 0 && noPrice > 0) {
    parts.push({
      categoryId: requireCategory(undefined),
      kind: 'NO_PRICE',
      valueCents: noPrice,
    });
  }
  if (adjustment !== 0) {
    parts.push({ kind: 'ADJUSTMENT', valueCents: adjustment });
  }

  return {
    parts: parts.filter((part) => part.valueCents !== 0),
    rows: input.rows.map((row) => ({
      filledByDifference: filled.has(row.id),
      id: row.id,
      lineTotalCents: row.lineTotalCents ?? filled.get(row.id),
    })),
  };
}
