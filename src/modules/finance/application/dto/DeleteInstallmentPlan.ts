import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const DeleteInstallmentPlanSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
});

export type DeleteInstallmentPlanInput = z.input<typeof DeleteInstallmentPlanSchema>;
