import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const DeleteCardEarlyPaymentSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1),
  id: z.string().min(1),
});

export type DeleteCardEarlyPaymentInput = z.input<typeof DeleteCardEarlyPaymentSchema>;
