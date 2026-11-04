import { z } from 'zod';

import { CalendarDateSchema } from '@finance/application/dto/FinanceCommon';
import type { CardInvoiceData } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';

export const ResolveCardRowsPaidSchema = z.object({
  // Spec 083: invoices the caller already computed in this request; only the cards missing here are read.
  invoiceData: z.array(z.custom<CardInvoiceData>()).optional(),
  // Spec 045: drops the card rows whose resolved status differs.
  paid: z.boolean().optional(),
  today: CalendarDateSchema,
  transactions: z.array(z.custom<TransactionEntity>()),
});

export type ResolveCardRowsPaidInput = z.input<typeof ResolveCardRowsPaidSchema>;
