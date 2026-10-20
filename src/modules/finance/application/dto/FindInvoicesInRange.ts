import { z } from 'zod';

import { AccessibleOwnersSchema, CalendarDateSchema } from '@finance/application/dto/FinanceCommon';

export const FindInvoicesInRangeSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardIds: z.array(z.string()).optional(),
  // Inclusive `YYYY-MM-DD` bounds of the invoice list date.
  from: CalendarDateSchema,
  ownerIds: z.array(z.string()).optional(),
  to: CalendarDateSchema,
  today: CalendarDateSchema,
});

export type FindInvoicesInRangeInput = z.input<typeof FindInvoicesInRangeSchema>;
