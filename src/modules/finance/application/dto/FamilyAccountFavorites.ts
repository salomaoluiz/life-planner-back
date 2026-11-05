import { z } from 'zod';

import { OwnerIdSchema } from '@finance/application/dto/FinanceCommon';

// Spec 094 FR 6: a user lost access to a family (removed, left), or the family is gone (no user).
export const FamilyAccountFavoritesSchema = z.object({
  familyId: OwnerIdSchema,
  userId: OwnerIdSchema.optional(),
});

export type FamilyAccountFavoritesInput = z.input<typeof FamilyAccountFavoritesSchema>;
