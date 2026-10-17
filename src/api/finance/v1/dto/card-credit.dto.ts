import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  DescriptionApiSchema,
  hasAtLeastOneField,
  ValueApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { InvoicePaymentMethod } from '@finance/domain/enum';

// `today` is the caller's local day (optional: the server's UTC date otherwise).
export const CreateRefundApiSchema = z
  .object({
    date: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    invoiceMonth: InvoiceMonthSchema,
    refundedPlanId: z.uuid().optional(),
    refundedTransactionId: z.uuid().optional(),
    today: CalendarDateApiSchema.optional(),
    value: ValueApiSchema,
  })
  .strict();
export const UpdateRefundApiSchema = z
  .object({
    date: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    invoiceMonth: InvoiceMonthSchema,
    refundedPlanId: z.uuid().nullable(),
    refundedTransactionId: z.uuid().nullable(),
    today: CalendarDateApiSchema,
    value: ValueApiSchema,
  })
  .partial()
  .strict()
  .refine((body) => hasAtLeastOneField({ ...body, today: undefined }), {
    message: 'At least one field is required',
  });
export const RefundApiSchema = z.object({
  creditCardId: z.uuid(),
  date: z.string(),
  description: z.string(),
  id: z.uuid(),
  invoiceMonth: z.string(),
  refundedPlanId: z.uuid().nullable(),
  refundedTransactionId: z.uuid().nullable(),
  value: z.number().int(),
});

// Exactly one shape per method: ACCOUNT needs accountId, EXTERNAL forbids it.
export const CreateEarlyPaymentApiSchema = z
  .object({
    accountId: z.uuid().optional(),
    date: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    invoiceMonth: InvoiceMonthSchema,
    method: z.enum(InvoicePaymentMethod),
    today: CalendarDateApiSchema.optional(),
    value: ValueApiSchema,
  })
  .strict()
  .refine(
    (body) => (body.method === InvoicePaymentMethod.ACCOUNT) === (body.accountId !== undefined),
    { message: 'accountId is required for ACCOUNT payments and forbidden for EXTERNAL ones' },
  );
export const UpdateEarlyPaymentApiSchema = z
  .object({
    accountId: z.uuid(),
    date: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    invoiceMonth: InvoiceMonthSchema,
    method: z.enum(InvoicePaymentMethod),
    today: CalendarDateApiSchema,
    value: ValueApiSchema,
  })
  .partial()
  .strict()
  .refine((body) => hasAtLeastOneField({ ...body, today: undefined }), {
    message: 'At least one field is required',
  });
export const EarlyPaymentApiSchema = z.object({
  accountId: z.uuid().optional(),
  accountTransactionId: z.uuid().optional(),
  date: z.string(),
  description: z.string(),
  id: z.uuid(),
  invoiceMonth: z.string(),
  method: z.enum(InvoicePaymentMethod),
  value: z.number().int(),
});

export type CreateEarlyPaymentApiInput = z.infer<typeof CreateEarlyPaymentApiSchema>;
export type CreateRefundApiInput = z.infer<typeof CreateRefundApiSchema>;
export type EarlyPaymentOutputShape = z.infer<typeof EarlyPaymentApiSchema>;
export type RefundOutputShape = z.infer<typeof RefundApiSchema>;
export type UpdateEarlyPaymentApiInput = z.infer<typeof UpdateEarlyPaymentApiSchema>;
export type UpdateRefundApiInput = z.infer<typeof UpdateRefundApiSchema>;

export class CreateEarlyPaymentBody extends createZodDto(CreateEarlyPaymentApiSchema) {}
export class CreateRefundBody extends createZodDto(CreateRefundApiSchema) {}
export class EarlyPaymentOutput extends createZodDto(EarlyPaymentApiSchema) {}
export class RefundOutput extends createZodDto(RefundApiSchema) {}
export class UpdateEarlyPaymentBody extends createZodDto(UpdateEarlyPaymentApiSchema) {}
export class UpdateRefundBody extends createZodDto(UpdateRefundApiSchema) {}
