import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const EndRecurrencesBySourceSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: z.string().min(1).optional(),
    creditCardId: z.string().min(1).optional(),
  })
  .refine((input) => (input.accountId === undefined) !== (input.creditCardId === undefined), {
    message: 'Send either accountId or creditCardId',
  });

export type EndRecurrencesBySourceInput = z.input<typeof EndRecurrencesBySourceSchema>;
