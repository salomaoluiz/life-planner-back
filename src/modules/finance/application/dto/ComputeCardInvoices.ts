import { z } from 'zod';

import { CalendarDateSchema } from '@finance/application/dto/FinanceCommon';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';

export const ComputeCardInvoicesSchema = z.object({
  cards: z.array(z.custom<CreditCardEntity>()),
  today: CalendarDateSchema,
});

export type ComputeCardInvoicesInput = z.input<typeof ComputeCardInvoicesSchema>;
