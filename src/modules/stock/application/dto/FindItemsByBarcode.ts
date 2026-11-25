import { z } from 'zod';

import { AccessibleOwnersSchema, OptionalTodaySchema } from '@stock/application/dto/StockCommon';

export const FindItemsByBarcodeSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  code: z.string().min(1).max(80),
  today: OptionalTodaySchema,
});

export type FindItemsByBarcodeInput = z.input<typeof FindItemsByBarcodeSchema>;
