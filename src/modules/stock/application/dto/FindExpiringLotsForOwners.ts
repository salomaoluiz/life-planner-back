import { z } from 'zod';

import { AccessibleOwnersSchema } from '@stock/application/dto/StockCommon';

export const FindExpiringLotsForOwnersSchema = z.object({
  // Owners already narrowed by the caller (archived families left out); a page of users shares one call.
  owners: AccessibleOwnersSchema,
  // The local date of the user being notified, YYYY-MM-DD.
  today: z.iso.date(),
});

export type FindExpiringLotsForOwnersInput = z.input<typeof FindExpiringLotsForOwnersSchema>;
