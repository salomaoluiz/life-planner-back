import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CurrencySchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';

export const EnsureTransactionConsistencySchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: z.string().min(1).optional(),
    // Create, and an update that MOVES the transaction to another account or card, may not target an archived one.
    blockArchivedAccount: z.boolean().default(false),
    categoryId: z.string().min(1),
    creditCardId: z.string().min(1).optional(),
    // When set, must equal the currency of the account or card (spec 040 FR 4).
    currency: CurrencySchema.optional(),
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    type: TransactionTypeSchema,
  })
  .refine((input) => (input.accountId === undefined) !== (input.creditCardId === undefined), {
    message: 'Send either accountId or creditCardId',
  });

export type EnsureTransactionConsistencyInput = z.input<typeof EnsureTransactionConsistencySchema>;
