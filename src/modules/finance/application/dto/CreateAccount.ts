import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  BalanceSchema,
  CalendarDateSchema,
  IconSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

export const CreateAccountSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  icon: IconSchema,
  initialBalance: BalanceSchema.default(0),
  name: NameSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  status: z.enum(AccountStatus).default(AccountStatus.ACTIVE),
  today: CalendarDateSchema,
});

export type CreateAccountInput = z.input<typeof CreateAccountSchema>;
