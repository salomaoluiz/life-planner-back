import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const GetCreditCardByIdSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type GetCreditCardByIdInput = z.input<typeof GetCreditCardByIdSchema>;
