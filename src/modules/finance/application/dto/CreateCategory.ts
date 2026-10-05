import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  IconColorSchema,
  IconSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';

export const CreateCategorySchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  icon: IconSchema,
  iconColor: IconColorSchema.default('#000000'),
  name: NameSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  parentId: z.string().min(1).optional(),
  type: TransactionTypeSchema,
});

export type CreateCategoryInput = z.input<typeof CreateCategorySchema>;
