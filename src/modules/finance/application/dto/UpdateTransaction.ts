import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TagNamesSchema,
  TransactionTypeSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';
import { InstallmentEditScope } from '@finance/domain/enum';

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
    paid: z.boolean().optional(),
    // Required for installments: which rows the edit reaches (spec 030 FR 11).
    scope: z.enum(InstallmentEditScope).optional(),
    // `[]` removes every tag; omitted leaves them (spec 043 FR 9).
    tags: TagNamesSchema.optional(),
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
      input.paid !== undefined ||
      input.tags !== undefined ||
      input.type !== undefined ||
      input.value !== undefined,
    { message: 'At least one field is required' },
  );

export type UpdateTransactionInput = z.input<typeof UpdateTransactionSchema>;
