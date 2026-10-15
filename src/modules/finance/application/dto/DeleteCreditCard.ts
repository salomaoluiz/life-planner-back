import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const DeleteCreditCardSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type DeleteCreditCardInput = z.input<typeof DeleteCreditCardSchema>;
