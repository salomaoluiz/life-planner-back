import { StockMovementTypes } from '@stock/domain/entity/StockMovementEntity';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

export interface GestureLot {
  // True when every movement of the lot belongs to the gesture (the gesture created it).
  createdByGesture: boolean;
  expirationDate?: Date;
  id: string;
  openedAt?: Date;
  purchaseDate?: Date;
  quantity: number;
}
export interface GestureLotUpdate {
  id: string;
  openedAt?: null;
  quantity?: number;
}
export interface GestureMovement {
  lotId: string;
  quantity: number;
  type: StockMovementTypes;
}
export interface UndoPlan {
  deleteLotIds: string[];
  lotUpdates: GestureLotUpdate[];
}

function sameDay(a?: Date, b?: Date): boolean {
  return a?.getTime() === b?.getTime();
}

// Spec 117 FR 8: reverse a gesture exactly (quantities, an OPEN split merged back, created lots removed).
// Throws `Error('NEGATIVE')` when a lot would end below zero (the lot changed after the gesture).
export function planUndo(movements: GestureMovement[], lots: GestureLot[]): UndoPlan {
  const updates = new Map<string, GestureLotUpdate>();
  const deleteLotIds: string[] = [];
  const touched = [...new Set(movements.map((movement) => movement.lotId))].sort();

  function patch(id: string, change: Omit<GestureLotUpdate, 'id'>) {
    updates.set(id, { ...updates.get(id), ...change, id });
  }
  function quantityOf(id: string): number {
    const lot = lots.find((candidate) => candidate.id === id);
    const pending = updates.get(id)?.quantity;

    return pending ?? lot?.quantity ?? 0;
  }

  for (const lotId of touched) {
    const lot = lots.find((candidate) => candidate.id === lotId);

    if (!lot) {
      continue;
    }

    const own = movements.filter((movement) => movement.lotId === lotId);
    const opens = own.filter((movement) => movement.type === StockMovementTypes.OPEN);
    const deltas = own.filter((movement) => movement.type !== StockMovementTypes.OPEN);
    const restored = fromMilli(
      toMilli(lot.quantity) - deltas.reduce((sum, movement) => sum + toMilli(movement.quantity), 0),
    );

    if (restored < 0) {
      throw new Error('NEGATIVE');
    }

    if (opens.length > 0 && lot.createdByGesture) {
      const origin = lots
        .filter(
          (candidate) =>
            candidate.id !== lot.id &&
            !candidate.openedAt &&
            sameDay(candidate.expirationDate, lot.expirationDate) &&
            sameDay(candidate.purchaseDate, lot.purchaseDate),
        )
        .sort((a, b) => a.id.localeCompare(b.id))[0];

      if (origin) {
        patch(origin.id, {
          quantity: fromMilli(toMilli(quantityOf(origin.id)) + toMilli(restored)),
        });
        deleteLotIds.push(lot.id);
        continue;
      }

      patch(lot.id, { openedAt: null, quantity: restored });
      continue;
    }

    if (opens.length > 0) {
      patch(lot.id, { openedAt: null, ...(deltas.length > 0 ? { quantity: restored } : {}) });
      continue;
    }

    if (lot.createdByGesture && restored === 0) {
      deleteLotIds.push(lot.id);
      continue;
    }

    patch(lot.id, { quantity: restored });
  }

  return { deleteLotIds, lotUpdates: [...updates.values()] };
}
