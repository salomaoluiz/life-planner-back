import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const GetAccountsByIdsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ids: z.array(z.string()),
});

export type GetAccountsByIdsInput = z.input<typeof GetAccountsByIdsSchema>;
