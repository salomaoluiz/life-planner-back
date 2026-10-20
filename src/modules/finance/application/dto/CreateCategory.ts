import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  ALL_SCOPES,
  IconColorSchema,
  IconSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';

// `owner: ALL` omits `ownerId`; the scopes are the caller's accessible owners.
export const CreateCategorySchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    // The user creating the category: the creator an ALL category follows.
    callerId: z.string().min(1).optional(),
    icon: IconSchema,
    iconColor: IconColorSchema.default('#000000'),
    name: NameSchema,
    owner: OwnerTypeSchema.or(z.literal(ALL_SCOPES)),
    ownerId: OwnerIdSchema.optional(),
    parentId: z.string().min(1).optional(),
    type: TransactionTypeSchema,
  })
  .refine(
    (input) =>
      input.owner === ALL_SCOPES ? input.callerId !== undefined : input.ownerId !== undefined,
    { message: 'ownerId is required (or callerId for ALL)' },
  );

export type CreateCategoryInput = z.input<typeof CreateCategorySchema>;
