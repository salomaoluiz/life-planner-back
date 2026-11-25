import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@stock/application/dto/StockCommon';

// Exactly one of `barcode` / `name` (spec 121 FR 12 and 18).
export const SuggestStockItemSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    barcode: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(3).max(100).optional(),
    now: z.date().optional(),
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    userId: z.string().min(1),
  })
  .refine((input) => (input.barcode === undefined) !== (input.name === undefined), {
    message: 'Send exactly one of barcode or name',
  });

export type SuggestStockItemInput = z.input<typeof SuggestStockItemSchema>;
