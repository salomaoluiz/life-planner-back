import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
  PreloadedSchema,
  TransactionFilterSchema,
} from '@finance/application/dto/FinanceCommon';
import type { CardInvoiceData } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionSource } from '@finance/domain/enum';
import {
  TRANSACTION_PAGE_DEFAULT_LIMIT,
  TRANSACTION_PAGE_MAX_LIMIT,
} from '@finance/domain/service/TransactionCursor';

export const GetTransactionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1).optional(),
  // Spec 078: opaque position of the last row of the previous page.
  cursor: z.string().optional(),
  // Spec 045: the optional filters of the list.
  filter: TransactionFilterSchema.optional(),
  invoiceMonth: InvoiceMonthSchema.optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(TRANSACTION_PAGE_MAX_LIMIT)
    .default(TRANSACTION_PAGE_DEFAULT_LIMIT),
  ownerIds: z.array(z.string()).optional(),
  preloaded: PreloadedSchema,
  source: z.enum(TransactionSource).default(TransactionSource.ACCOUNT),
  // Needed to place CARD rows in a period by their invoice list date.
  today: CalendarDateSchema.optional(),
});

export type GetTransactionsInput = z.input<typeof GetTransactionsSchema>;
export interface TransactionPage {
  // Spec 083: set when the CARD period lookup computed the invoices; the caller reuses them.
  invoiceData?: CardInvoiceData[];
  items: TransactionEntity[];
  nextCursor: null | string;
}
