import { z } from 'zod';

import { InstallmentsSchema } from '@finance/application/dto/CreateInstallmentPlan';
import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';

export const UpdateInstallmentPlanSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    categoryId: z.string().min(1).optional(),
    creditCardId: z.string().min(1).optional(),
    date: CalendarDateSchema.optional(),
    description: DescriptionSchema.optional(),
    id: z.string().min(1),
    installments: InstallmentsSchema.optional(),
    today: CalendarDateSchema,
    // The new TOTAL in cents.
    value: ValueSchema.optional(),
  })
  .refine(
    (input) =>
      input.categoryId !== undefined ||
      input.creditCardId !== undefined ||
      input.date !== undefined ||
      input.description !== undefined ||
      input.installments !== undefined ||
      input.value !== undefined,
    { message: 'At least one field is required' },
  );

export type UpdateInstallmentPlanInput = z.input<typeof UpdateInstallmentPlanSchema>;
