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

export const CreateTransactionSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  date: CalendarDateSchema,
  description: DescriptionSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  type: TransactionTypeSchema,
  value: ValueSchema,
});

export type CreateTransactionInput = z.input<typeof CreateTransactionSchema>;
