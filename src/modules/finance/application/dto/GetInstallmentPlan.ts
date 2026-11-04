import { z } from 'zod';

import { AccessibleOwnersSchema, CalendarDateSchema } from '@finance/application/dto/FinanceCommon';
import type { CardInvoiceData } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import type CreditCardEntity from '@finance/domain/entity/CreditCardEntity';

export const GetInstallmentPlanSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // Spec 083: the card and its invoices when the caller already has them from this request.
  card: z.custom<CreditCardEntity>().optional(),
  id: z.string().min(1),
  invoiceData: z.custom<CardInvoiceData>().optional(),
  today: CalendarDateSchema,
});

export type GetInstallmentPlanInput = z.input<typeof GetInstallmentPlanSchema>;
