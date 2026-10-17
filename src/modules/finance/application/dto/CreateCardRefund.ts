import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  InvoiceMonthSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';

export const CreateCardRefundSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1),
  date: CalendarDateSchema,
  description: DescriptionSchema,
  invoiceMonth: InvoiceMonthSchema,
  refundedPlanId: z.string().min(1).optional(),
  refundedTransactionId: z.string().min(1).optional(),
  today: CalendarDateSchema,
  value: ValueSchema,
});

export type CreateCardRefundInput = z.input<typeof CreateCardRefundSchema>;
