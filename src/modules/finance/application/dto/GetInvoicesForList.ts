import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
  TransactionFilterSchema,
} from '@finance/application/dto/FinanceCommon';

// Exactly one of `month` or the `from`/`to` period of the filter selects the invoices (spec 045 §7).
export const GetInvoicesForListSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    filter: TransactionFilterSchema.optional(),
    month: InvoiceMonthSchema.optional(),
    ownerIds: z.array(z.string()).optional(),
    today: CalendarDateSchema,
  })
  .refine((value) => (value.month === undefined) !== (value.filter?.from === undefined), {
    message: 'Send either month or from and to',
  });

export type GetInvoicesForListInput = z.input<typeof GetInvoicesForListSchema>;
