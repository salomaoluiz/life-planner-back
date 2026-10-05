import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  IconColorSchema,
  IconSchema,
  NameSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';

export const UpdateCategorySchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    icon: IconSchema.optional(),
    iconColor: IconColorSchema.optional(),
    id: z.string().min(1),
    name: NameSchema.optional(),
    // `null` makes the category a root.
    parentId: z.string().min(1).nullable().optional(),
    type: TransactionTypeSchema.optional(),
  })
  .refine(
    (input) =>
      input.icon !== undefined ||
      input.iconColor !== undefined ||
      input.name !== undefined ||
      input.parentId !== undefined ||
      input.type !== undefined,
    { message: 'At least one field is required' },
  );

export type UpdateCategoryInput = z.input<typeof UpdateCategorySchema>;
