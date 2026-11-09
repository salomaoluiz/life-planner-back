import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';
import { InstallmentEditScope } from '@finance/domain/enum';

export const TransferAccessSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  // Delete only: required on an occurrence of a series.
  scope: z.enum(InstallmentEditScope).optional(),
});

export type TransferAccessInput = z.input<typeof TransferAccessSchema>;
