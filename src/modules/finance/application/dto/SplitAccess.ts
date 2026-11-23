import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const SplitAccessSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // Spec 120: set only by the stock purchase flow, never from a request body.
  fromStockPurchase: z.boolean().optional(),
  id: z.string().min(1),
});

export type SplitAccessInput = z.input<typeof SplitAccessSchema>;
