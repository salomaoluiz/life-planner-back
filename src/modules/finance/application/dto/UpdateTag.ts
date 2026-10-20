import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  ALL_SCOPES,
  TagNameSchema,
} from '@finance/application/dto/FinanceCommon';

export const UpdateTagSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    callerId: z.string().min(1).optional(),
    id: z.string().min(1),
    name: TagNameSchema.optional(),
    // Only switching a single-scope tag to ALL exists; there is no way back.
    scope: z.literal(ALL_SCOPES).optional(),
  })
  .refine((input) => input.name !== undefined || input.scope !== undefined, {
    message: 'At least one field is required',
  });

export type UpdateTagInput = z.input<typeof UpdateTagSchema>;
