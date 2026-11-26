import { toMilli } from '@stock/domain/service/StockQuantity';

export interface DiscardValue {
  currency?: string;
  source: DiscardValueSource;
  valueCents?: number;
}
export type DiscardValueSource = 'ITEM_LAST' | 'LOT' | 'NONE';

// Spec 123 FR 26: an entry into an existing lot averages the lot price (on its remaining quantity) with the entry
// price by quantity, half-up to cents; an entry without a price keeps the lot price; a lot without a price takes the
// entry price.
export function averageLotPrice(
  existing: { quantity: number; unitPriceCents?: number },
  entry: { quantity: number; unitPriceCents?: number },
): number | undefined {
  if (entry.unitPriceCents === undefined) {
    return existing.unitPriceCents;
  }

  if (existing.unitPriceCents === undefined || existing.quantity <= 0) {
    return entry.unitPriceCents;
  }

  const existingMilli = toMilli(existing.quantity);
  const entryMilli = toMilli(entry.quantity);

  return Math.floor(
    (existingMilli * existing.unitPriceCents + entryMilli * entry.unitPriceCents) /
      (existingMilli + entryMilli) +
      0.5,
  );
}

// FR 27: the value of a discard, recorded when it happens and never recomputed: the lot price, else the item's last
// paid price, else none.
export function discardValue(input: {
  lastPrice?: { currency: string; unitPriceCents: number };
  lotCurrency?: string;
  lotPriceCents?: number;
  quantity: number;
}): DiscardValue {
  if (input.lotPriceCents !== undefined) {
    return {
      currency: input.lotCurrency,
      source: 'LOT',
      valueCents: roundValue(input.lotPriceCents, input.quantity),
    };
  }

  if (input.lastPrice) {
    return {
      currency: input.lastPrice.currency,
      source: 'ITEM_LAST',
      valueCents: roundValue(input.lastPrice.unitPriceCents, input.quantity),
    };
  }

  return { source: 'NONE' };
}

function roundValue(unitPriceCents: number, quantity: number): number {
  return Math.floor((unitPriceCents * toMilli(quantity)) / 1000 + 0.5);
}
