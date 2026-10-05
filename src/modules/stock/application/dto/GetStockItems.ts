import { z } from 'zod';

import { AccessibleOwnersSchema } from '@stock/application/dto/StockCommon';

export const GetStockItemsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerId: z.string().min(1).optional(),
});

export type GetStockItemsInput = z.input<typeof GetStockItemsSchema>;
