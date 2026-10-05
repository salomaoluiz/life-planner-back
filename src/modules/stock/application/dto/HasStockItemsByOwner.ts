import { z } from 'zod';

import { OwnerIdSchema, OwnerTypeSchema } from '@stock/application/dto/StockCommon';

export const HasStockItemsByOwnerSchema = z.object({
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
});

export type HasStockItemsByOwnerInput = z.input<typeof HasStockItemsByOwnerSchema>;
