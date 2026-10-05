import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';

export const GetCategoriesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerIds: z.array(z.string()).optional(),
  type: TransactionTypeSchema.optional(),
});

export type GetCategoriesInput = z.input<typeof GetCategoriesSchema>;
