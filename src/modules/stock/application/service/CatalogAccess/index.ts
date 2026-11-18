import { NotFoundException } from '@nestjs/common';

import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { hasOwnerAccess, OwnerAccess } from '@stock/domain/entity/OwnerAccess';

// Categories and locations of an owner the caller cannot reach answer 404 (never confirm they exist).
export function ensureCatalogWritable(accessibleOwners: OwnerAccess[], target: OwnerAccess): void {
  ensureOwnerReadable(accessibleOwners, target);
  ensureOwnerWritable(accessibleOwners, target);
}
export function ensureOwnerReadable(accessibleOwners: OwnerAccess[], target: OwnerAccess): void {
  if (!hasOwnerAccess(accessibleOwners, target)) {
    throw new NotFoundException();
  }
}
