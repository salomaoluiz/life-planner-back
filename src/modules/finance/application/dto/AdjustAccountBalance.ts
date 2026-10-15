import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  BalanceSchema,
  CalendarDateSchema,
} from '@finance/application/dto/FinanceCommon';

export const AdjustAccountBalanceSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // The balance the user wants to see NOW (cents, may be negative).
  balance: BalanceSchema,
  id: z.string().min(1),
  today: CalendarDateSchema,
});

export type AdjustAccountBalanceInput = z.input<typeof AdjustAccountBalanceSchema>;
