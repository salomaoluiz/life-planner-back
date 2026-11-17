import { StockUnits } from '@stock/domain/entity/StockEntity';

export const MAX_QUANTITY = 1_000_000;

const MILLI = 1000;

// Quantities are numeric(14,3): every comparison and sum runs on integer thousandths.
export function fromMilli(milli: number): number {
  return milli / MILLI;
}
export function toMilli(quantity: number): number {
  return Math.round(quantity * MILLI);
}

// `undefined` when valid, otherwise the 422 message (spec 116 FR 2).
export function quantityError(unit: StockUnits, quantity: number): string | undefined {
  if (unit === StockUnits.UNIT) {
    return Number.isInteger(quantity) ? undefined : 'Unit quantities must be whole numbers';
  }

  return Math.abs(quantity * MILLI - Math.round(quantity * MILLI)) > 1e-6
    ? 'Quantities accept up to 3 decimals'
    : undefined;
}
