import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const DeleteCardRefundSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1),
  id: z.string().min(1),
});

export type DeleteCardRefundInput = z.input<typeof DeleteCardRefundSchema>;
