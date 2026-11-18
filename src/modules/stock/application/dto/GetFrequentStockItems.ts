import { z } from 'zod';

import { AccessibleOwnersSchema, OptionalTodaySchema } from '@stock/application/dto/StockCommon';

export const FREQUENT_DAYS = 30;
export const DEFAULT_FREQUENT_LIMIT = 5;

export const GetFrequentStockItemsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  limit: z.number().int().min(1).max(10).default(DEFAULT_FREQUENT_LIMIT),
  now: z.date().optional(),
  today: OptionalTodaySchema,
});

export type GetFrequentStockItemsInput = z.input<typeof GetFrequentStockItemsSchema>;
