import { z } from 'zod';

import { AccessibleOwnersSchema, InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { TransactionSource } from '@finance/domain/enum';

export const GetTransactionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  creditCardId: z.string().min(1).optional(),
  invoiceMonth: InvoiceMonthSchema.optional(),
  ownerIds: z.array(z.string()).optional(),
  source: z.enum(TransactionSource).default(TransactionSource.ACCOUNT),
});

export type GetTransactionsInput = z.input<typeof GetTransactionsSchema>;
