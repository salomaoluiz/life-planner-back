import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@stock/application/dto/StockCommon';

export const SUGGESTION_LIMIT = 8;

export const SuggestStockItemsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  q: z.string().trim().min(2).max(100),
});

export type SuggestStockItemsInput = z.input<typeof SuggestStockItemsSchema>;
