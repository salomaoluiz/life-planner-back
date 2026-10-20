import { z } from 'zod';

import { CalendarDateSchema } from '@finance/application/dto/FinanceCommon';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';

export const ResolveCardRowsPaidSchema = z.object({
  // Spec 045: drops the card rows whose resolved status differs.
  paid: z.boolean().optional(),
  today: CalendarDateSchema,
  transactions: z.array(z.custom<TransactionEntity>()),
});

export type ResolveCardRowsPaidInput = z.input<typeof ResolveCardRowsPaidSchema>;
