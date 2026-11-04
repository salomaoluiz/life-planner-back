import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const GetTransactionByIdSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type GetTransactionByIdInput = z.input<typeof GetTransactionByIdSchema>;
