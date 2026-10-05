import { z } from 'zod';

import { AccessibleOwnersSchema } from '@stock/application/dto/StockCommon';

export const GetStockItemByIdSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type GetStockItemByIdInput = z.input<typeof GetStockItemByIdSchema>;
