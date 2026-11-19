import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const SplitAccessSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type SplitAccessInput = z.input<typeof SplitAccessSchema>;
