import { z } from 'zod';

import { CalendarDateSchema } from '@finance/application/dto/FinanceCommon';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';

export const ComputeCardInvoicesSchema = z.object({
  cards: z.array(z.custom<CreditCardEntity>()),
  // Spec 091: the caller only needs invoices from this `YYYY-MM` on (and the recent-paid window), so the settled
  // prefix of each card's totals is left out of the chain. Omitted = every total, as before.
  fromMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  today: CalendarDateSchema,
});

export type ComputeCardInvoicesInput = z.input<typeof ComputeCardInvoicesSchema>;
