import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  BalanceSchema,
  CalendarDateSchema,
  CurrencySchema,
  IconSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';
import { DEFAULT_CURRENCY } from '@finance/domain/enum/Currency';

export const CreateAccountSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    currency: CurrencySchema.default(DEFAULT_CURRENCY),
    icon: IconSchema,
    initialBalance: BalanceSchema.default(0),
    isFavorite: z.boolean().optional(),
    name: NameSchema,
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    status: z.enum(AccountStatus).default(AccountStatus.ACTIVE),
    today: CalendarDateSchema,
    // Required with `isFavorite`: the favorite is the preference of this user.
    userId: z.string().min(1).optional(),
  })
  .refine((input) => input.isFavorite === undefined || input.userId !== undefined, {
    message: 'userId is required with isFavorite',
  });

export type CreateAccountInput = z.input<typeof CreateAccountSchema>;
