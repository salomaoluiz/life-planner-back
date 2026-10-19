import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
} from '@finance/application/dto/FinanceCommon';

export const GetDailyBalancesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  month: InvoiceMonthSchema,
  ownerIds: z.array(z.string()).optional(),
  today: CalendarDateSchema,
});

export type GetDailyBalancesInput = z.input<typeof GetDailyBalancesSchema>;
