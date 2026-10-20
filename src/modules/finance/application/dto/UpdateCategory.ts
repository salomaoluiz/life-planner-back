import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  ALL_SCOPES,
  IconColorSchema,
  IconSchema,
  NameSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

export const UpdateCategorySchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    callerId: z.string().min(1).optional(),
    icon: IconSchema.optional(),
    iconColor: IconColorSchema.optional(),
    id: z.string().min(1),
    name: NameSchema.optional(),
    // `null` makes the category a root.
    parentId: z.string().min(1).nullable().optional(),
    // Only switching a single-scope category to ALL exists (spec 038 FR 3); there is no way back.
    scope: z.literal(ALL_SCOPES).optional(),
    // ARCHIVED / ACTIVE applies to the whole subtree (spec 041).
    status: z.enum(AccountStatus).optional(),
    type: TransactionTypeSchema.optional(),
  })
  .refine(
    (input) =>
      input.icon !== undefined ||
      input.iconColor !== undefined ||
      input.name !== undefined ||
      input.parentId !== undefined ||
      input.scope !== undefined ||
      input.status !== undefined ||
      input.type !== undefined,
    { message: 'At least one field is required' },
  );

export type UpdateCategoryInput = z.input<typeof UpdateCategorySchema>;
