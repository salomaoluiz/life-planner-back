import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  DescriptionApiSchema,
  hasAtLeastOneField,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  ValueApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { InvoiceStatus } from '@finance/domain/enum';
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS } from '@finance/domain/service/InstallmentPlan';

const InstallmentsApiSchema = z.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS);

// `today` is the caller's local day (optional: the server's UTC date otherwise).
export const CreateInstallmentPlanApiSchema = z
  .object({
    categoryId: z.uuid(),
    creditCardId: z.uuid(),
    date: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    installments: InstallmentsApiSchema,
    owner: OwnerTypeApiSchema,
    ownerId: OwnerIdApiSchema,
    today: CalendarDateApiSchema.optional(),
    value: ValueApiSchema,
  })
  .refine((body) => body.value >= body.installments, {
    message: 'The total needs at least one cent per installment',
    path: ['value'],
  });

export const UpdateInstallmentPlanApiSchema = z
  .object({
    categoryId: z.uuid(),
    creditCardId: z.uuid(),
    date: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    installments: InstallmentsApiSchema,
    value: ValueApiSchema,
  })
  .partial()
  .strict()
  .refine(hasAtLeastOneField, {
    message: 'At least one field is required',
  });

export const InstallmentPlanApiSchema = z.object({
  installments: z.array(
    z.object({
      id: z.uuid(),
      installmentNumber: z.number().int(),
      invoiceMonth: z.string(),
      invoiceStatus: z.enum(InvoiceStatus),
      value: z.number().int(),
    }),
  ),
  overLimit: z.boolean().optional(),
  plan: z.object({
    categoryId: z.uuid(),
    creditCardId: z.uuid(),
    date: z.string(),
    description: z.string(),
    id: z.uuid(),
    installmentCount: z.number().int(),
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
    totalValue: z.number().int(),
  }),
});

export type CreateInstallmentPlanApiInput = z.infer<typeof CreateInstallmentPlanApiSchema>;
export type InstallmentPlanOutputShape = z.infer<typeof InstallmentPlanApiSchema>;
export type UpdateInstallmentPlanApiInput = z.infer<typeof UpdateInstallmentPlanApiSchema>;

export class CreateInstallmentPlanBody extends createZodDto(CreateInstallmentPlanApiSchema) {}
export class InstallmentPlanOutput extends createZodDto(InstallmentPlanApiSchema) {}
export class UpdateInstallmentPlanBody extends createZodDto(UpdateInstallmentPlanApiSchema) {}
