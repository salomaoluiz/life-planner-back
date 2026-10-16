import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  InvoiceMonthSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';

export const UpdateCardRefundSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1),
  date: CalendarDateSchema.optional(),
  description: DescriptionSchema.optional(),
  id: z.string().min(1),
  invoiceMonth: InvoiceMonthSchema.optional(),
  // `null` removes the link.
  refundedPlanId: z.string().min(1).nullable().optional(),
  refundedTransactionId: z.string().min(1).nullable().optional(),
  today: CalendarDateSchema,
  value: ValueSchema.optional(),
});

export type UpdateCardRefundInput = z.input<typeof UpdateCardRefundSchema>;
