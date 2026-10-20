import { z } from 'zod';

import { OwnerIdSchema } from '@finance/application/dto/FinanceCommon';

// Family membership changes of a user that created ALL categories (spec 038 FR 11-14).
export const CategoryMembershipSchema = z.object({
  familyId: OwnerIdSchema,
  userId: OwnerIdSchema,
});
export const FamilyScopeSchema = z.object({ familyId: OwnerIdSchema });

export type CategoryMembershipInput = z.input<typeof CategoryMembershipSchema>;
export type FamilyScopeInput = z.input<typeof FamilyScopeSchema>;
