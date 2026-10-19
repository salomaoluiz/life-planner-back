import { z } from 'zod';

import { AccessibleOwnersSchema, CalendarDateSchema } from '@finance/application/dto/FinanceCommon';

export const MaterializeRecurrencesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // Narrows the accessible owners (the `ownerId` query of the reads).
  ownerIds: z.array(z.string()).optional(),
  today: CalendarDateSchema,
});

export type MaterializeRecurrencesInput = z.input<typeof MaterializeRecurrencesSchema>;
