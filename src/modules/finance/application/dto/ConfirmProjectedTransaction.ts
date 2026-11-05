import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';

// Spec 096 FR 4: the real charge of a projected card purchase.
export const ConfirmProjectedTransactionSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  date: CalendarDateSchema,
  id: z.string().min(1),
  // Spec 095 rules: the previous, computed or next invoice of `date`. Omitted → computed.
  invoiceMonth: InvoiceMonthSchema.optional(),
  today: CalendarDateSchema,
  value: ValueSchema,
});

export type ConfirmProjectedTransactionInput = z.input<typeof ConfirmProjectedTransactionSchema>;
