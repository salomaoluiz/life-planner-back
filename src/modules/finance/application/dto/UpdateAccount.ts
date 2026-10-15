import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  IconSchema,
  NameSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

export const UpdateAccountSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    icon: IconSchema.optional(),
    id: z.string().min(1),
    name: NameSchema.optional(),
    status: z.enum(AccountStatus).optional(),
    today: CalendarDateSchema,
  })
  .refine(
    (input) => input.icon !== undefined || input.name !== undefined || input.status !== undefined,
    { message: 'At least one field is required' },
  );

export type UpdateAccountInput = z.input<typeof UpdateAccountSchema>;
