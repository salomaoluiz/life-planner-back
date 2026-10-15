import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

export const GetCreditCardsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerIds: z.array(z.string()).optional(),
  status: z.enum(AccountStatus).optional(),
});

export type GetCreditCardsInput = z.input<typeof GetCreditCardsSchema>;
