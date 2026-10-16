import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
} from '@finance/application/dto/FinanceCommon';

export const GetInvoiceSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1),
  invoiceMonth: InvoiceMonthSchema,
  today: CalendarDateSchema,
});

export type GetInvoiceInput = z.input<typeof GetInvoiceSchema>;
