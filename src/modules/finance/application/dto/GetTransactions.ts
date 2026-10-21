import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
  TransactionFilterSchema,
} from '@finance/application/dto/FinanceCommon';
import { TransactionSource } from '@finance/domain/enum';

export const GetTransactionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1).optional(),
  // Spec 045: the optional filters of the list.
  filter: TransactionFilterSchema.optional(),
  invoiceMonth: InvoiceMonthSchema.optional(),
  ownerIds: z.array(z.string()).optional(),
  source: z.enum(TransactionSource).default(TransactionSource.ACCOUNT),
  // Needed to place CARD rows in a period by their invoice list date.
  today: CalendarDateSchema.optional(),
});

export type GetTransactionsInput = z.input<typeof GetTransactionsSchema>;
