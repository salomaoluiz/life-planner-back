import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  BalanceSchema,
  IconSchema,
  NameSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

export const UpdateAccountSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    balance: BalanceSchema.optional(),
    icon: IconSchema.optional(),
    id: z.string().min(1),
    name: NameSchema.optional(),
    status: z.enum(AccountStatus).optional(),
  })
  .refine(
    (input) =>
      input.balance !== undefined ||
      input.icon !== undefined ||
      input.name !== undefined ||
      input.status !== undefined,
    { message: 'At least one field is required' },
  );

export type UpdateAccountInput = z.input<typeof UpdateAccountSchema>;
