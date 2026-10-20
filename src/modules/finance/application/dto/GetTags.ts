import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const GetTagsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerIds: z.array(z.string()).optional(),
  q: z.string().trim().min(1).optional(),
});

export type GetTagsInput = z.input<typeof GetTagsSchema>;
