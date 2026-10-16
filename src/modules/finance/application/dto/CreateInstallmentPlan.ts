import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS } from '@finance/domain/service/InstallmentPlan';

export const InstallmentsSchema = z.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS);

export const CreateInstallmentPlanSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    categoryId: z.string().min(1),
    creditCardId: z.string().min(1),
    date: CalendarDateSchema,
    description: DescriptionSchema,
    installments: InstallmentsSchema,
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    // Local calendar day of the caller: only used to read the card's invoices after the purchase.
    today: CalendarDateSchema,
    // The TOTAL in cents.
    value: ValueSchema,
  })
  .refine((input) => input.value >= input.installments, {
    message: 'The total needs at least one cent per installment',
    path: ['value'],
  });

export type CreateInstallmentPlanInput = z.input<typeof CreateInstallmentPlanSchema>;
