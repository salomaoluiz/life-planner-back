import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
} from '@finance/application/dto/FinanceCommon';
import { InvoicePaymentMethod } from '@finance/domain/enum';

export const PayInvoiceSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: z.string().min(1).optional(),
    creditCardId: z.string().min(1),
    invoiceMonth: InvoiceMonthSchema,
    method: z.enum(InvoicePaymentMethod),
    paidOn: CalendarDateSchema,
    today: CalendarDateSchema,
  })
  .refine(
    (input) => (input.method === InvoicePaymentMethod.ACCOUNT) === (input.accountId !== undefined),
    { message: 'accountId is required for ACCOUNT payments and forbidden for EXTERNAL ones' },
  );

export type PayInvoiceInput = z.input<typeof PayInvoiceSchema>;
