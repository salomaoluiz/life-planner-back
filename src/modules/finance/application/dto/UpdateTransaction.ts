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

export const UpdateTransactionSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    creditCardId: z.string().min(1).optional(),
    date: CalendarDateSchema.optional(),
    description: DescriptionSchema.optional(),
    id: z.string().min(1),
    owner: OwnerTypeSchema.optional(),
    ownerId: OwnerIdSchema.optional(),
    today: CalendarDateSchema,
    type: TransactionTypeSchema.optional(),
    value: ValueSchema.optional(),
  })
  .refine((input) => input.accountId === undefined || input.creditCardId === undefined, {
    message: 'Send either accountId or creditCardId',
  })
  .refine(
    (input) =>
      input.accountId !== undefined ||
      input.categoryId !== undefined ||
      input.creditCardId !== undefined ||
      input.date !== undefined ||
      input.description !== undefined ||
      input.owner !== undefined ||
      input.ownerId !== undefined ||
      input.type !== undefined ||
      input.value !== undefined,
    { message: 'At least one field is required' },
  );

export type UpdateTransactionInput = z.input<typeof UpdateTransactionSchema>;
