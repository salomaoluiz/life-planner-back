import { z } from 'zod';

import { AccessibleOwnersSchema, OptionalTodaySchema } from '@stock/application/dto/StockCommon';

export const GetWasteSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // YYYY-MM; absent = the current month.
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  ownerId: z.string().min(1).optional(),
  today: OptionalTodaySchema,
  // `all` returns every item of the month instead of the top 5 ("Ver mais N itens").
  topLimit: z.literal('all').optional(),
});

export type GetWasteInput = z.input<typeof GetWasteSchema>;
