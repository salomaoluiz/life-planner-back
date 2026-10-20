import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  CurrencyApiSchema,
  DescriptionApiSchema,
  hasAtLeastOneField,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  ValueApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { InvoiceStatus } from '@finance/domain/enum';
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS } from '@finance/domain/service/InstallmentPlan';

const InstallmentsApiSchema = z.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS);

// `today` is the caller's local day (optional: the server's UTC date otherwise).
export const CreateInstallmentPlanApiSchema = z
  .object({
    categoryId: z.uuid(),
    creditCardId: z.uuid(),
    currency: CurrencyApiSchema.optional(),
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
      prepaid: z.boolean(),
      value: z.number().int(),
    }),
  ),
  overLimit: z.boolean().optional(),
  plan: z.object({
    categoryId: z.uuid(),
    creditCardId: z.uuid(),
    currency: CurrencyApiSchema,
    date: z.string(),
    description: z.string(),
    id: z.uuid(),
    installmentCount: z.number().int(),
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
    prepayment: z
      .object({
        date: z.string(),
        discount: z.number().int(),
        id: z.uuid(),
        targetInvoiceMonth: z.string(),
      })
      .nullable(),
    totalValue: z.number().int(),
  }),
});

export const PrepayInstallmentPlanApiSchema = z
  .object({
    date: CalendarDateApiSchema,
    discount: z.number().int().min(0).optional(),
    targetInvoiceMonth: InvoiceMonthSchema,
    today: CalendarDateApiSchema.optional(),
  })
  .strict();
export const PrepaymentPreviewQuerySchema = z.object({
  targetInvoiceMonth: InvoiceMonthSchema,
  today: CalendarDateApiSchema.optional(),
});
export const PrepaymentPreviewApiSchema = z.object({
  eligible: z.array(
    z.object({
      id: z.uuid(),
      installmentNumber: z.number().int(),
      invoiceMonth: z.string(),
      value: z.number().int(),
    }),
  ),
  total: z.number().int(),
});

export type CreateInstallmentPlanApiInput = z.infer<typeof CreateInstallmentPlanApiSchema>;
export type InstallmentPlanOutputShape = z.infer<typeof InstallmentPlanApiSchema>;
export type PrepayInstallmentPlanApiInput = z.infer<typeof PrepayInstallmentPlanApiSchema>;
export type UpdateInstallmentPlanApiInput = z.infer<typeof UpdateInstallmentPlanApiSchema>;

export class CreateInstallmentPlanBody extends createZodDto(CreateInstallmentPlanApiSchema) {}
export class InstallmentPlanOutput extends createZodDto(InstallmentPlanApiSchema) {}
export class PrepayInstallmentPlanBody extends createZodDto(PrepayInstallmentPlanApiSchema) {}
export class PrepaymentPreviewOutput extends createZodDto(PrepaymentPreviewApiSchema) {}
export class UpdateInstallmentPlanBody extends createZodDto(UpdateInstallmentPlanApiSchema) {}
