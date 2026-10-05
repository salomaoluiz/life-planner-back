import { z } from 'zod';

import { AccessibleOwnersSchema } from '@stock/application/dto/StockCommon';

export const DeleteStockItemSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type DeleteStockItemInput = z.input<typeof DeleteStockItemSchema>;
