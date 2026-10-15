import { z } from 'zod';

import { AccessibleOwnersSchema, CalendarDateSchema } from '@finance/application/dto/FinanceCommon';

export const GetCreditCardsOverviewSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerIds: z.array(z.string()).optional(),
  today: CalendarDateSchema,
});

export type GetCreditCardsOverviewInput = z.input<typeof GetCreditCardsOverviewSchema>;
