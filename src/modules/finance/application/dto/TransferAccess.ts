import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const TransferAccessSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type TransferAccessInput = z.input<typeof TransferAccessSchema>;
