import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
  PreloadedSchema,
} from '@finance/application/dto/FinanceCommon';

export const GetDailyBalancesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  month: InvoiceMonthSchema,
  ownerIds: z.array(z.string()).optional(),
  // Spec 083: unfiltered accounts and cards of the same narrowed owners, when the caller already read them.
  preloaded: PreloadedSchema,
  today: CalendarDateSchema,
  // Spec 053: the last month of the range (default: `month`).
  untilMonth: InvoiceMonthSchema.optional(),
});

export type GetDailyBalancesInput = z.input<typeof GetDailyBalancesSchema>;
