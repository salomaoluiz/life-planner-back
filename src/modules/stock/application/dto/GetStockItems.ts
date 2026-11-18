import { z } from 'zod';

import { AccessibleOwnersSchema, OptionalTodaySchema } from '@stock/application/dto/StockCommon';

export const GetStockItemsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  categoryIds: z.array(z.string().min(1)).optional(),
  locationIds: z.array(z.string().min(1)).optional(),
  ownerId: z.string().min(1).optional(),
  today: OptionalTodaySchema,
});

export type GetStockItemsInput = z.input<typeof GetStockItemsSchema>;
