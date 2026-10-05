import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  BalanceSchema,
  IconSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

export const CreateAccountSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  balance: BalanceSchema.default(0),
  icon: IconSchema,
  name: NameSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  status: z.enum(AccountStatus).default(AccountStatus.ACTIVE),
});

export type CreateAccountInput = z.input<typeof CreateAccountSchema>;
