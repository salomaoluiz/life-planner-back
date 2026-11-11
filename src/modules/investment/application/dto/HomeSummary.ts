import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  OwnerIdSchema,
} from '@investment/application/dto/InvestmentCommon';

// Spec 109: the owners to consolidate (each one must be readable) and the client's local date.
export const GetInvestmentsHomeSummarySchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerIds: z.array(OwnerIdSchema).min(1),
  today: z.iso.date(),
});
export type GetInvestmentsHomeSummaryInput = z.input<typeof GetInvestmentsHomeSummarySchema>;
