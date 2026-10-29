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
  // Spec 053: the last month of the range (default: `month`).
  untilMonth: InvoiceMonthSchema.optional(),
});

export type GetDailyBalancesInput = z.input<typeof GetDailyBalancesSchema>;
