import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TransactionTypeSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';

export const CreateTransactionSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1),
    creditCardId: z.string().min(1).optional(),
    date: CalendarDateSchema,
    description: DescriptionSchema,
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    // Local calendar day of the caller: only used to read the card's invoices after a purchase.
    today: CalendarDateSchema,
    type: TransactionTypeSchema,
    value: ValueSchema,
  })
  .refine((input) => (input.accountId === undefined) !== (input.creditCardId === undefined), {
    message: 'Send either accountId or creditCardId',
  });

export type CreateTransactionInput = z.input<typeof CreateTransactionSchema>;
