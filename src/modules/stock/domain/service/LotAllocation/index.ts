import { effectiveExpiration } from '@stock/domain/service/LotExpiration';
import { compareNullsLast } from '@stock/domain/service/NullsLast';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

export interface AllocationLot {
  expirationDate?: Date;
  id: string;
  openedAt?: Date;
  quantity: number;
}
export interface AllocationStep {
  lotId: string;
  quantity: number;
}

function byDateNullsLast(a: Date | undefined, b: Date | undefined): number {
  return compareNullsLast(a?.getTime(), b?.getTime());
}
function byId(a: AllocationLot, b: AllocationLot): number {
  return a.id.localeCompare(b.id);
}

// Spec 116 FR 14: open lots first (earliest effective expiration), then closed lots by printed date, nulls last.
export function consumeOrder(lots: AllocationLot[], openedShelfLifeDays?: number): AllocationLot[] {
  const open = lots
    .filter((lot) => lot.openedAt)
    .sort(
      (a, b) =>
        byDateNullsLast(
          effectiveExpiration(a, openedShelfLifeDays),
          effectiveExpiration(b, openedShelfLifeDays),
        ) || byId(a, b),
    );
  const closed = lots
    .filter((lot) => !lot.openedAt)
    .sort((a, b) => byDateNullsLast(a.expirationDate, b.expirationDate) || byId(a, b));

  return [...open, ...closed];
}

// One step per lot touched; `undefined` when the lots do not hold the quantity (409, nothing written).
export function planConsume(
  lots: AllocationLot[],
  quantity: number,
  openedShelfLifeDays?: number,
): AllocationStep[] | undefined {
  let missing = toMilli(quantity);
  const steps: AllocationStep[] = [];

  for (const lot of consumeOrder(
    lots.filter((item) => item.quantity > 0),
    openedShelfLifeDays,
  )) {
    if (missing <= 0) {
      break;
    }

    const taken = Math.min(missing, toMilli(lot.quantity));

    steps.push({ lotId: lot.id, quantity: fromMilli(taken) });
    missing -= taken;
  }

  return missing > 0 ? undefined : steps;
}

function sameDay(a: Date | undefined, b: Date | undefined): boolean {
  return a?.getTime() === b?.getTime();
}

// FR 12: the closed lot with the same expiration (both null counts as the same); never an open lot.
export function findEntryLot<T extends AllocationLot>(
  lots: T[],
  expirationDate: Date | undefined,
): T | undefined {
  return lots.find((lot) => !lot.openedAt && sameDay(lot.expirationDate, expirationDate));
}

// FR 15: the closed lot with the earliest expiration.
export function defaultOpenLot<T extends AllocationLot>(lots: T[]): T | undefined {
  return lots
    .filter((lot) => !lot.openedAt && lot.quantity > 0)
    .sort((a, b) => byDateNullsLast(a.expirationDate, b.expirationDate) || byId(a, b))[0];
}

// The opened quantity is capped to the lot; the lot splits only when something stays closed.
export function planOpen(
  lot: AllocationLot,
  quantity: number,
): { openedQuantity: number; split: boolean } {
  const openedQuantity = fromMilli(Math.min(toMilli(quantity), toMilli(lot.quantity)));

  return { openedQuantity, split: toMilli(openedQuantity) < toMilli(lot.quantity) };
}
