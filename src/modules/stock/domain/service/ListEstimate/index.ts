import { toMilli } from '@stock/domain/service/StockQuantity';

export interface ListSummary {
  estimatedTotalCents: number;
  pricedCount: number;
  rowCount: number;
}
export type PriceSource = 'HISTORY_ANY_MARKET' | 'HISTORY_DEFAULT_MARKET' | 'MANUAL' | 'NONE';

// Spec 118 FR 20: unit price × quantity in minor units, rounded half-up per row.
export function rowEstimateCents(unitPriceCents: number, quantity: number): number {
  return Math.round((unitPriceCents * toMilli(quantity)) / 1000);
}

// Spec 118 FR 21: only the manual estimate exists until the price history arrives (spec 120).
export function resolveUnitPrice(manualCents?: number): {
  priceSource: PriceSource;
  unitPriceCents?: number;
} {
  return manualCents === undefined
    ? { priceSource: 'NONE' }
    : { priceSource: 'MANUAL', unitPriceCents: manualCents };
}
export function summarizeEstimates(estimates: (number | undefined)[]): ListSummary {
  return {
    estimatedTotalCents: estimates.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    pricedCount: estimates.filter((value) => value !== undefined).length,
    rowCount: estimates.length,
  };
}
