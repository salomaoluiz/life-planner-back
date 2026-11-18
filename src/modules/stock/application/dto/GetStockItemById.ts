import { z } from 'zod';

import { AccessibleOwnersSchema, OptionalTodaySchema } from '@stock/application/dto/StockCommon';

export const GetStockItemByIdSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  today: OptionalTodaySchema,
});

export type GetStockItemByIdInput = z.input<typeof GetStockItemByIdSchema>;
