import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

// Spec 116 FR 19.
export function needsRestock(stockOnly: boolean, quantity: number, minQuantity?: number): boolean {
  return !stockOnly && toMilli(quantity) <= toMilli(minQuantity ?? 0);
}
export function restockQuantity(quantity: number, idealQuantity?: number): number {
  return idealQuantity === undefined ? 1 : fromMilli(toMilli(idealQuantity) - toMilli(quantity));
}
