import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const GetTransactionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerIds: z.array(z.string()).optional(),
});

export type GetTransactionsInput = z.input<typeof GetTransactionsSchema>;
