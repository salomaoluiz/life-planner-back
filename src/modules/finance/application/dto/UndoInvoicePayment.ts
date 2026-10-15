import { z } from 'zod';

import { AccessibleOwnersSchema, InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';

export const UndoInvoicePaymentSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1),
  invoiceMonth: InvoiceMonthSchema,
});

export type UndoInvoicePaymentInput = z.input<typeof UndoInvoicePaymentSchema>;
