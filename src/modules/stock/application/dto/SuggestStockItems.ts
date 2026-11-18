import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@stock/application/dto/StockCommon';

export const SUGGESTION_LIMIT = 8;

export const SuggestStockItemsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // Spec 117 FR 29: both absent = every owner the requester can write (quick add).
  owner: OwnerTypeSchema.optional(),
  ownerId: OwnerIdSchema.optional(),
  q: z.string().trim().min(2).max(100),
});

export type SuggestStockItemsInput = z.input<typeof SuggestStockItemsSchema>;
