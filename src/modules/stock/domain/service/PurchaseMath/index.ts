import { rowEstimateCents } from '@stock/domain/service/ListEstimate';
import { toMilli } from '@stock/domain/service/StockQuantity';

// Spec 120 FR 20: the badge shows from this percent (either direction).
export const PRICE_CHANGE_NOTICE_PERCENT = 5;

export interface PricedRow {
  lineTotalCents?: number;
  priceInput?: PriceInputs;
  unitPriceCents?: number;
}
export type PriceInputs = 'LINE' | 'UNIT';
export interface PriceRow {
  lineTotalCents?: number;
  priceInput?: PriceInputs;
  quantity?: number;
  unitPriceCents?: number;
}

// FR 14: lineTotal = round_half_up(unit × quantity); unit = round_half_up(lineTotal / quantity).
export function lineFromUnit(unitPriceCents: number, quantity: number): number {
  return rowEstimateCents(unitPriceCents, quantity);
}
export function unitFromLine(lineTotalCents: number, quantity: number): number {
  const milli = toMilli(quantity);

  return Math.floor((lineTotalCents * 1000 + milli / 2) / milli);
}

// FR 14: the typed value wins; the other one is computed. Without a quantity only the typed one is kept
// (kg/L "sem peso"), and without a typed price nothing is stored.
export function resolvePrice(row: PriceRow): PricedRow {
  const { lineTotalCents, priceInput, quantity, unitPriceCents } = row;
  const input = priceInput ?? (unitPriceCents === undefined ? 'LINE' : 'UNIT');

  if (input === 'UNIT' && unitPriceCents !== undefined) {
    return {
      lineTotalCents: quantity === undefined ? undefined : lineFromUnit(unitPriceCents, quantity),
      priceInput: 'UNIT',
      unitPriceCents,
    };
  }

  if (lineTotalCents === undefined) {
    return {};
  }

  return {
    lineTotalCents,
    priceInput: 'LINE',
    unitPriceCents: quantity === undefined ? undefined : unitFromLine(lineTotalCents, quantity),
  };
}

// FR 20: rounded integer percent from the last unit price; null without history or without a current price.
export function priceChangeNotice(percent: null | number): 'CHEAPER' | 'NONE' | 'UP' {
  if (percent === null) {
    return 'NONE';
  }
  if (percent >= PRICE_CHANGE_NOTICE_PERCENT) {
    return 'UP';
  }

  return percent <= -PRICE_CHANGE_NOTICE_PERCENT ? 'CHEAPER' : 'NONE';
}
export function priceChangePercent(lastCents?: number, currentCents?: number): null | number {
  if (!lastCents || !currentCents) {
    return null;
  }

  return Math.round(((currentCents - lastCents) / lastCents) * 100);
}

// FR 19: the cart counts the IN_CART rows; unpriced ones are counted apart.
export function cartTotals(rows: { inCart: boolean; lineTotalCents?: number }[]) {
  const inCart = rows.filter((row) => row.inCart);

  return {
    count: inCart.length,
    totalCents: inCart.reduce((sum, row) => sum + (row.lineTotalCents ?? 0), 0),
    unpricedCount: inCart.filter((row) => row.lineTotalCents === undefined).length,
  };
}
