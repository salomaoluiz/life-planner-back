import { ConflictException, NotFoundException } from '@nestjs/common';

import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { hasOwnerAccess, OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { GestureContext } from '@stock/domain/repository';
import { GestureLot, planUndo, UndoPlan } from '@stock/domain/service/GestureUndo';
import { isWithinUndoWindow } from '@stock/domain/service/UndoWindow';

export const UNDO_TOO_LATE = 'Não dá mais para desfazer';

// Spec 117 FR 8: same user (the repository already filters by it), the item readable and writable, inside the
// window and no later movement on the touched lots; then the pure reversal. Every refusal aborts the transaction.
export function reverseGesture(
  context: GestureContext,
  accessibleOwners: OwnerAccess[],
  now: Date,
): UndoPlan {
  if (!hasOwnerAccess(accessibleOwners, context.item)) {
    throw new NotFoundException();
  }

  ensureOwnerWritable(accessibleOwners, context.item);

  const lastMovementAt = Math.max(
    ...context.movements.map((movement) => movement.createdAt.getTime()),
  );

  if (!isWithinUndoWindow(new Date(lastMovementAt), now) || context.laterLotIds.length > 0) {
    throw new ConflictException(UNDO_TOO_LATE);
  }

  const foreign = new Set(context.foreignLotIds);
  const lots: GestureLot[] = context.item.lots.map((lot) => ({
    createdByGesture: !foreign.has(lot.id),
    expirationDate: lot.expirationDate,
    id: lot.id,
    openedAt: lot.openedAt,
    purchaseDate: lot.purchaseDate,
    quantity: lot.quantity,
  }));

  try {
    return planUndo(
      context.movements.map((movement) => ({
        lotId: movement.lotId,
        quantity: movement.quantity,
        type: movement.type,
      })),
      lots,
    );
  } catch {
    throw new ConflictException(UNDO_TOO_LATE);
  }
}
