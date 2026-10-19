import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';
import { InstallmentEditScope } from '@finance/domain/enum';

export const DeleteTransactionSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  // Required on a recurring occurrence (spec 034 FR 29): only ONLY_THIS is deleted here.
  scope: z.enum(InstallmentEditScope).optional(),
});

export type DeleteTransactionInput = z.input<typeof DeleteTransactionSchema>;
