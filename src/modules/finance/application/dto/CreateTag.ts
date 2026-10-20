import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  ALL_SCOPES,
  OwnerIdSchema,
  OwnerTypeSchema,
  TagNameSchema,
} from '@finance/application/dto/FinanceCommon';

// `owner: ALL` omits `ownerId`; the scopes are the caller's accessible owners.
export const CreateTagSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    // The user creating the tag: the creator an ALL tag follows.
    callerId: z.string().min(1).optional(),
    name: TagNameSchema,
    owner: OwnerTypeSchema.or(z.literal(ALL_SCOPES)),
    ownerId: OwnerIdSchema.optional(),
  })
  .refine(
    (input) =>
      input.owner === ALL_SCOPES ? input.callerId !== undefined : input.ownerId !== undefined,
    { message: 'ownerId is required (or callerId for ALL)' },
  );

export type CreateTagInput = z.input<typeof CreateTagSchema>;
