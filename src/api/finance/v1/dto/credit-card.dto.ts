import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CurrencyApiSchema,
  hasAtLeastOneField,
  IconColorApiSchema,
  NameApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import {
  BillingDaySchema,
  CreditCardBrandSchema,
  CreditCardLimitSchema,
  LastDigitsSchema,
} from '@finance/application/dto/CreditCardCommon';
import { AccountStatus, InvoicePaymentMethod, InvoiceStatus } from '@finance/domain/enum';
import { DEFAULT_CURRENCY } from '@finance/domain/enum/Currency';

const StatusApiSchema = z.enum(AccountStatus);

export const CreateCreditCardApiSchema = z.object({
  brand: CreditCardBrandSchema,
  closingDay: BillingDaySchema,
  color: IconColorApiSchema,
  currency: CurrencyApiSchema.default(DEFAULT_CURRENCY),
  dueDay: BillingDaySchema,
  lastDigits: LastDigitsSchema.optional(),
  limit: CreditCardLimitSchema,
  owner: OwnerTypeApiSchema,
  ownerId: OwnerIdApiSchema,
  paymentAccountId: z.uuid().optional(),
  paymentDay: BillingDaySchema.optional(),
  status: StatusApiSchema.default(AccountStatus.ACTIVE),
  title: NameApiSchema,
});

// `.strict()` rejects unknown keys; owner and ownerId travel together (the use case also checks access).
export const UpdateCreditCardApiSchema = z
  .object({
    brand: CreditCardBrandSchema,
    closingDay: BillingDaySchema,
    color: IconColorApiSchema,
    dueDay: BillingDaySchema,
    lastDigits: LastDigitsSchema.nullable(),
    limit: CreditCardLimitSchema,
    owner: OwnerTypeApiSchema,
    ownerId: OwnerIdApiSchema,
    paymentAccountId: z.uuid().nullable(),
    paymentDay: BillingDaySchema.nullable(),
    status: StatusApiSchema,
    title: NameApiSchema,
  })
  .partial()
  .strict()
  .refine(hasAtLeastOneField, { message: 'At least one field is required' })
  .refine((value) => (value.owner === undefined) === (value.ownerId === undefined), {
    message: 'owner and ownerId must be sent together',
  });

export const CreditCardApiSchema = z.object({
  brand: CreditCardBrandSchema,
  closingDay: z.number().int(),
  color: z.string(),
  createdAt: z.iso.datetime(),
  currency: CurrencyApiSchema,
  dueDay: z.number().int(),
  id: z.uuid(),
  lastDigits: z.string().optional(),
  limit: z.number().int(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  // The linked account is `null` for a reader who cannot access it (spec 035 FR 23).
  paymentAccount: z
    .object({ icon: z.string(), id: z.uuid(), name: z.string(), status: StatusApiSchema })
    .nullable(),
  paymentAccountId: z.uuid().nullable(),
  paymentDay: z.number().int().optional(),
  status: StatusApiSchema,
  title: z.string(),
  updatedAt: z.iso.datetime(),
});

export const InvoicePaymentApiSchema = z.object({
  accountId: z.uuid().nullable(),
  accountName: z.string().nullable(),
  amount: z.number().int(),
  method: z.enum(InvoicePaymentMethod),
  paidOn: z.string(),
});

export const InvoiceApiSchema = z.object({
  amount: z.number().int(),
  amountDue: z.number().int(),
  carryIn: z.number().int(),
  closingDate: z.string(),
  currency: CurrencyApiSchema,
  dueDate: z.string(),
  earlyPaid: z.number().int(),
  listDate: z.string(),
  net: z.number().int(),
  payment: InvoicePaymentApiSchema.nullable(),
  paymentAfterDue: z.boolean(),
  paymentDate: z.string(),
  periodEnd: z.string(),
  periodStart: z.string(),
  referenceMonth: z.string(),
  status: z.enum(InvoiceStatus),
  total: z.number().int(),
});

export const CreditCardsOverviewApiSchema = z.object({
  aggregate: z.object({
    available: z.number().int(),
    totalLimit: z.number().int(),
    used: z.number().int(),
  }),
  cards: z.array(
    z.object({
      available: z.number().int(),
      card: CreditCardApiSchema,
      closedInvoices: z.array(InvoiceApiSchema),
      openInvoice: InvoiceApiSchema,
      upcomingInvoices: z.array(InvoiceApiSchema),
      used: z.number().int(),
    }),
  ),
});

export type CreateCreditCardApiInput = z.infer<typeof CreateCreditCardApiSchema>;
export type UpdateCreditCardApiInput = z.infer<typeof UpdateCreditCardApiSchema>;

export class CreateCreditCardBody extends createZodDto(CreateCreditCardApiSchema) {}
export class CreditCardOutput extends createZodDto(CreditCardApiSchema) {}
export class CreditCardsOverviewOutput extends createZodDto(CreditCardsOverviewApiSchema) {}
export class UpdateCreditCardBody extends createZodDto(UpdateCreditCardApiSchema) {}
