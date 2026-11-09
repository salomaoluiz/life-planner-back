import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  IconSchema,
  NameSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus, AccountType } from '@finance/domain/enum';

export const UpdateAccountSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    icon: IconSchema.optional(),
    id: z.string().min(1),
    isFavorite: z.boolean().optional(),
    name: NameSchema.optional(),
    status: z.enum(AccountStatus).optional(),
    today: CalendarDateSchema,
    type: z.enum(AccountType).optional(),
    // Required with `isFavorite`: the favorite is the preference of this user.
    userId: z.string().min(1).optional(),
  })
  .refine(
    (input) =>
      input.icon !== undefined ||
      input.isFavorite !== undefined ||
      input.name !== undefined ||
      input.status !== undefined ||
      input.type !== undefined,
    { message: 'At least one field is required' },
  )
  .refine((input) => input.isFavorite === undefined || input.userId !== undefined, {
    message: 'userId is required with isFavorite',
  });

export type UpdateAccountInput = z.input<typeof UpdateAccountSchema>;
