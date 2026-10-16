import { z } from 'zod';

import { AccessibleOwnersSchema, CalendarDateSchema } from '@finance/application/dto/FinanceCommon';

export const GetInstallmentPlanSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  today: CalendarDateSchema,
});

export type GetInstallmentPlanInput = z.input<typeof GetInstallmentPlanSchema>;
