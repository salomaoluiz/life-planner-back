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

export const CreateAccountSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  currency: CurrencySchema.default(DEFAULT_CURRENCY),
  icon: IconSchema,
  initialBalance: BalanceSchema.default(0),
  name: NameSchema,
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  status: z.enum(AccountStatus).default(AccountStatus.ACTIVE),
  today: CalendarDateSchema,
});

export type CreateAccountInput = z.input<typeof CreateAccountSchema>;
