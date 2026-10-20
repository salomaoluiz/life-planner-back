import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  CurrencySchema,
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
    currency: CurrencySchema.optional(),
    date: CalendarDateSchema,
    description: DescriptionSchema,
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    // Account rows only; omitted → paid when dated up to `today` (spec 033 FR 4).
    paid: z.boolean().optional(),
    // Local calendar day of the caller: only used to read the card's invoices after a purchase.
    today: CalendarDateSchema,
    type: TransactionTypeSchema,
    value: ValueSchema,
  })
  .refine((input) => (input.accountId === undefined) !== (input.creditCardId === undefined), {
    message: 'Send either accountId or creditCardId',
  });

export type CreateTransactionInput = z.input<typeof CreateTransactionSchema>;
