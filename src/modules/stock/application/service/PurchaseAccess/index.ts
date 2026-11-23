import { ConflictException, NotFoundException } from '@nestjs/common';

import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { hasOwnerAccess, OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import PurchaseEntity, { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import { IPurchaseRepository } from '@stock/domain/repository';

// Spec 120 FR 30: a closing lock is valid for 15 minutes and renewed by any closing request.
export const CLOSING_LOCK_MS = 15 * 60 * 1000;

// A purchase the caller cannot read answers 404 (it inherits the list owner's access, §4).
export function isClosingLocked(purchase: PurchaseEntity, now: Date): boolean {
  return (
    purchase.closingBy !== undefined &&
    purchase.closingAt !== undefined &&
    now.getTime() - purchase.closingAt.getTime() < CLOSING_LOCK_MS
  );
}
export async function loadReadablePurchase(
  repository: IPurchaseRepository,
  accessibleOwners: OwnerAccess[],
  id: string,
): Promise<PurchaseEntity> {
  const purchase = await repository.findById(id);

  if (!purchase || !hasOwnerAccess(accessibleOwners, purchase)) {
    throw new NotFoundException();
  }

  return purchase;
}
export async function loadWritablePurchase(
  repository: IPurchaseRepository,
  accessibleOwners: OwnerAccess[],
  id: string,
): Promise<PurchaseEntity> {
  const purchase = await loadReadablePurchase(repository, accessibleOwners, id);

  ensureOwnerWritable(accessibleOwners, purchase);

  return purchase;
}
// FR 13/30: row writes need an OPEN purchase that nobody else is closing.
export function ensureRowsWritable(purchase: PurchaseEntity, userId: string, now: Date): void {
  if (purchase.status !== PurchaseStatuses.OPEN) {
    throw new ConflictException({
      code: 'PURCHASE_NOT_OPEN',
      message: 'The purchase is not open',
    });
  }

  if (isClosingLocked(purchase, now) && purchase.closingBy !== userId) {
    throw new ConflictException({
      code: 'PURCHASE_CLOSING',
      message: 'Someone is closing this purchase',
    });
  }
}
