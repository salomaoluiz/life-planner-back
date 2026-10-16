import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  INT4_MAX,
  InvoiceMonthSchema,
} from '@finance/application/dto/FinanceCommon';

export const PrepayInstallmentPlanSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  date: CalendarDateSchema,
  // Cents; 0 or omitted = no discount.
  discount: z.number().int().min(0).max(INT4_MAX).optional(),
  id: z.string().min(1),
  targetInvoiceMonth: InvoiceMonthSchema,
  today: CalendarDateSchema,
});

export type PrepayInstallmentPlanInput = z.input<typeof PrepayInstallmentPlanSchema>;
