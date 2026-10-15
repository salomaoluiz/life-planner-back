import { z } from 'zod';

import { CalendarDateSchema } from '@finance/application/dto/FinanceCommon';
import AccountEntity from '@finance/domain/entity/AccountEntity';

export const AttachAccountBalancesSchema = z.object({
  accounts: z.array(z.custom<AccountEntity>()),
  today: CalendarDateSchema,
});

export type AttachAccountBalancesInput = z.input<typeof AttachAccountBalancesSchema>;
