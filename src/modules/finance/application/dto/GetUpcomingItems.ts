import { z } from 'zod';

import { AccessibleOwnersSchema, CalendarDateSchema } from '@finance/application/dto/FinanceCommon';

export const GetUpcomingItemsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // The next-days window: `today` to `today + days`, inclusive.
  days: z.number().int().min(1).max(31).default(7),
  // At most this many items of the next-days window; overdue is never cut. The API caps it at 20 (spec 062); the
  // notification collector (spec 124) asks for up to 1000.
  limit: z.number().int().min(1).max(1000).default(5),
  ownerIds: z.array(z.string()).optional(),
  today: CalendarDateSchema,
});

export type GetUpcomingItemsInput = z.input<typeof GetUpcomingItemsSchema>;
