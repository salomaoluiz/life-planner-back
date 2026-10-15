import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';

export const EnsureTransactionConsistencySchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  accountId: z.string().min(1),
  // Create, and an update that MOVES the transaction to another account, may not target an archived one.
  blockArchivedAccount: z.boolean().default(false),
  categoryId: z.string().min(1),
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  type: TransactionTypeSchema,
});

export type EnsureTransactionConsistencyInput = z.input<typeof EnsureTransactionConsistencySchema>;
