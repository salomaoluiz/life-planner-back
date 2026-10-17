import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const UndoInstallmentPrepaymentSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type UndoInstallmentPrepaymentInput = z.input<typeof UndoInstallmentPrepaymentSchema>;
