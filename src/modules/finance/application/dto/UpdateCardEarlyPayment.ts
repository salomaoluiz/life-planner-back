import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  InvoiceMonthSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';
import { InvoicePaymentMethod } from '@finance/domain/enum';

export const UpdateCardEarlyPaymentSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  accountId: z.string().min(1).optional(),
  creditCardId: z.string().min(1),
  date: CalendarDateSchema.optional(),
  description: DescriptionSchema.optional(),
  id: z.string().min(1),
  invoiceMonth: InvoiceMonthSchema.optional(),
  method: z.enum(InvoicePaymentMethod).optional(),
  today: CalendarDateSchema,
  value: ValueSchema.optional(),
});

export type UpdateCardEarlyPaymentInput = z.input<typeof UpdateCardEarlyPaymentSchema>;
