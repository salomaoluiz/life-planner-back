import { z } from 'zod';

import { OwnerIdSchema, OwnerTypeSchema } from '@stock/application/dto/StockCommon';

export const DeleteStockItemsByOwnerSchema = z.object({
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
});

export type DeleteStockItemsByOwnerInput = z.input<typeof DeleteStockItemsByOwnerSchema>;
