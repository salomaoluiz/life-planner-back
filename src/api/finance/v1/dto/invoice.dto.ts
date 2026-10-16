import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { InvoiceApiSchema, InvoicePaymentApiSchema } from '@api/finance/v1/dto/credit-card.dto';
import {
  CalendarDateApiSchema,
  IconColorApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { InvoicePaymentMethod } from '@finance/domain/enum';

export const InvoiceMonthParamSchema = InvoiceMonthSchema;

const PurchaseApiSchema = z.object({
  category: z.string(),
  categoryIcon: z.string(),
  categoryIconColor: IconColorApiSchema,
  categoryId: z.uuid(),
  date: z.string(),
  description: z.string(),
  id: z.uuid(),
  installmentCount: z.number().int().nullable(),
  installmentNumber: z.number().int().nullable(),
  ownerId: z.uuid(),
  prepaid: z.boolean(),
  value: z.number().int(),
});
const InvoiceCreditApiSchema = z.object({
  accountId: z.uuid().nullable(),
  accountName: z.string().nullable(),
  date: z.string(),
  description: z.string(),
  id: z.uuid(),
  kind: z.enum(['EARLY_PAYMENT', 'PREPAYMENT_DISCOUNT', 'REFUND']),
  method: z.enum(InvoicePaymentMethod).nullable(),
  refundedName: z.string().nullable(),
  refundedPlanId: z.uuid().nullable(),
  refundedTransactionId: z.uuid().nullable(),
  value: z.number().int(),
});
const InvoiceCardApiSchema = z.object({
  color: z.string(),
  id: z.uuid(),
  lastDigits: z.string().optional(),
  owner: OwnerTypeApiSchema,
  ownerId: OwnerIdApiSchema,
  title: z.string(),
});

// Exactly one shape per method: ACCOUNT needs accountId, EXTERNAL forbids it.
export const PayInvoiceApiSchema = z
  .object({
    accountId: z.uuid().optional(),
    method: z.enum(InvoicePaymentMethod),
    paidOn: CalendarDateApiSchema.optional(),
  })
  .strict()
  .refine(
    (value) => (value.method === InvoicePaymentMethod.ACCOUNT) === (value.accountId !== undefined),
    {
      message: 'accountId is required for ACCOUNT payments and forbidden for EXTERNAL ones',
    },
  );

export const InvoiceDetailApiSchema = z.object({
  card: InvoiceCardApiSchema,
  credits: z.array(InvoiceCreditApiSchema),
  invoice: InvoiceApiSchema,
  purchases: z.array(PurchaseApiSchema),
});
export const InvoicePaymentOutputApiSchema = InvoicePaymentApiSchema.extend({
  creditCardId: z.uuid(),
  invoiceMonth: z.string(),
});

export type PayInvoiceApiInput = z.infer<typeof PayInvoiceApiSchema>;

export class InvoiceDetailOutput extends createZodDto(InvoiceDetailApiSchema) {}
export class InvoicePaymentOutput extends createZodDto(InvoicePaymentOutputApiSchema) {}
export class InvoicesForListOutput extends createZodDto(z.array(InvoiceDetailApiSchema)) {}
export class PayInvoiceBody extends createZodDto(PayInvoiceApiSchema) {}
