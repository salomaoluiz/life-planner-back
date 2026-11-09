import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  CurrencyApiSchema,
  DescriptionApiSchema,
  hasAtLeastOneField,
  IconColorApiSchema,
  NotesApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  TagNamesApiSchema,
  TransactionTypeApiSchema,
  ValueApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { TagRefApiSchema } from '@api/finance/v1/dto/tag.dto';
import { InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { InstallmentEditScope, RecurrenceFrequency, SystemCategoryKey } from '@finance/domain/enum';

const TransactionFieldsSchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid(),
  creditCardId: z.uuid(),
  date: CalendarDateApiSchema,
  description: DescriptionApiSchema,
  // Spec 095: card purchases only (installment rows with `scope`).
  invoiceMonth: InvoiceMonthSchema,
  notes: NotesApiSchema,
  owner: OwnerTypeApiSchema,
  ownerId: OwnerIdApiSchema,
  // Account rows only: omitted on create → paid when dated up to `today` (spec 033).
  paid: z.boolean(),
  // Spec 043: tag names, resolved (or created) in the owner. `[]` removes all; omitted leaves them.
  tags: TagNamesApiSchema,
  type: TransactionTypeApiSchema,
  value: ValueApiSchema,
});

// Exactly one of accountId / creditCardId: a card purchase has no account (spec 029).
export const CreateTransactionApiSchema = TransactionFieldsSchema.partial({
  accountId: true,
  creditCardId: true,
  invoiceMonth: true,
  notes: true,
  paid: true,
  tags: true,
})
  .extend({ currency: CurrencyApiSchema.optional(), projected: z.boolean().optional() })
  .refine((value) => (value.accountId === undefined) !== (value.creditCardId === undefined), {
    message: 'Send either accountId or creditCardId',
  });

// Spec 096 FR 4: the real charge of a projected card purchase.
export const ConfirmTransactionApiSchema = z.strictObject({
  date: CalendarDateApiSchema,
  invoiceMonth: InvoiceMonthSchema.optional(),
  value: ValueApiSchema,
});

export const UpdateTransactionApiSchema = TransactionFieldsSchema.partial()
  .extend({ scope: z.enum(InstallmentEditScope).optional() })
  .strict()
  .refine((value) => value.accountId === undefined || value.creditCardId === undefined, {
    message: 'Send either accountId or creditCardId',
  })
  .refine(hasAtLeastOneField, { message: 'At least one field is required' });

export const TransactionApiSchema = z.object({
  account: z.object({ icon: z.string(), id: z.uuid(), name: z.string() }).nullable(),
  accountId: z.uuid().nullable(),
  category: z.object({
    excludeFromTotals: z.boolean(),
    icon: z.string(),
    iconColor: IconColorApiSchema,
    id: z.uuid(),
    name: z.string(),
    systemKey: z.enum(SystemCategoryKey).nullable(),
  }),
  categoryId: z.uuid(),
  createdAt: z.iso.datetime(),
  creditCard: z
    .object({
      color: z.string(),
      id: z.uuid(),
      lastDigits: z.string().optional(),
      title: z.string(),
    })
    .nullable(),
  creditCardId: z.uuid().nullable(),
  currency: CurrencyApiSchema,
  date: z.string(),
  description: z.string(),
  earlyPayment: z
    .object({ creditCardId: z.uuid(), id: z.uuid(), invoiceMonth: z.string() })
    .nullable(),
  id: z.uuid(),
  installmentCount: z.number().int().nullable(),
  installmentNumber: z.number().int().nullable(),
  installmentPlanId: z.uuid().nullable(),
  invoiceMonth: z.string().nullable(),
  // Spec 059: free text of normal rows; always null on system rows.
  notes: z.string().nullable(),
  // Only on create / update responses of card purchases: the purchase left the card over its limit.
  overLimit: z.boolean().optional(),
  // Series position / total (null without end date) / id / frequency; all null outside a recurring series.
  occurrenceCount: z.number().int().nullable(),
  occurrenceNumber: z.number().int().nullable(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  // Stored for account rows; derived from the invoice for card rows.
  paid: z.boolean(),
  projected: z.boolean(),
  recurrenceFrequency: z.enum(RecurrenceFrequency).nullable(),
  recurrenceId: z.uuid().nullable(),
  tags: z.array(TagRefApiSchema),
  type: TransactionTypeApiSchema,
  updatedAt: z.iso.datetime(),
  value: z.number().int(),
});

export type ConfirmTransactionApiInput = z.infer<typeof ConfirmTransactionApiSchema>;
export type CreateTransactionApiInput = z.infer<typeof CreateTransactionApiSchema>;
export type UpdateTransactionApiInput = z.infer<typeof UpdateTransactionApiSchema>;

export class ConfirmTransactionBody extends createZodDto(ConfirmTransactionApiSchema) {}
export class CreateTransactionBody extends createZodDto(CreateTransactionApiSchema) {}
// Spec 079: a row carries ids only; the entities it references come once in `lookups`. Null and empty
// fields are left out, and so are the timestamps and the ids that were repeated by nested objects.
export const TransactionItemApiSchema = z.strictObject({
  accountId: z.uuid().optional(),
  categoryId: z.uuid(),
  creditCardId: z.uuid().optional(),
  currency: CurrencyApiSchema,
  date: z.string(),
  description: z.string(),
  earlyPayment: TransactionApiSchema.shape.earlyPayment.unwrap().optional(),
  id: z.uuid(),
  installmentCount: z.number().int().optional(),
  installmentNumber: z.number().int().optional(),
  installmentPlanId: z.uuid().optional(),
  invoiceMonth: z.string().optional(),
  notes: z.string().optional(),
  occurrenceCount: z.number().int().optional(),
  occurrenceNumber: z.number().int().optional(),
  overLimit: z.boolean().optional(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  paid: z.boolean(),
  projected: z.boolean().optional(),
  recurrenceFrequency: z.enum(RecurrenceFrequency).optional(),
  recurrenceId: z.uuid().optional(),
  tagIds: z.array(z.uuid()).optional(),
  // Spec 098: out, in and fee rows of a transfer (`lookups.transfers[transferId]`).
  transferId: z.uuid().optional(),
  type: TransactionTypeApiSchema,
  value: z.number().int(),
});

export const TransactionLookupsApiSchema = z.strictObject({
  accounts: z.record(z.uuid(), z.strictObject({ icon: z.string(), name: z.string() })),
  categories: z.record(
    z.uuid(),
    z.strictObject({
      excludeFromTotals: z.literal(true).optional(),
      icon: z.string(),
      iconColor: IconColorApiSchema,
      name: z.string(),
      systemKey: z.enum(SystemCategoryKey).optional(),
    }),
  ),
  creditCards: z.record(
    z.uuid(),
    z.strictObject({
      color: z.string(),
      lastDigits: z.string().optional(),
      title: z.string(),
    }),
  ),
  tags: z.record(z.uuid(), z.strictObject({ name: z.string() })),
  // Spec 098: present only when a row belongs to a transfer. A side the caller cannot read is left out and
  // `counterpartHidden` is true (the row is read-only, "Conta de outro dono").
  transfers: z
    .record(
      z.uuid(),
      z.strictObject({
        amountIn: z.number().int().nullable().optional(),
        amountOut: z.number().int().nullable().optional(),
        counterpartHidden: z.literal(true).optional(),
        currencyIn: CurrencyApiSchema,
        currencyOut: CurrencyApiSchema,
        dateIn: z.string(),
        dateOut: z.string(),
        feeTransactionId: z.uuid().optional(),
        fromAccountId: z.uuid().optional(),
        recurrenceId: z.uuid().optional(),
        toAccountId: z.uuid().optional(),
      }),
    )
    .optional(),
});

// Spec 078: one keyset page of the list; `nextCursor` is null on the last page.
export const TransactionPageApiSchema = z.object({
  items: z.array(TransactionItemApiSchema),
  lookups: TransactionLookupsApiSchema,
  nextCursor: z.string().nullable(),
});

export const TransactionWithLookupsApiSchema = z.object({
  item: TransactionItemApiSchema,
  lookups: TransactionLookupsApiSchema,
});

export type TransactionItem = z.infer<typeof TransactionItemApiSchema>;
export type TransactionLookups = z.infer<typeof TransactionLookupsApiSchema>;

export class TransactionOutput extends createZodDto(TransactionApiSchema) {}
export class TransactionPageOutput extends createZodDto(TransactionPageApiSchema) {}
export class TransactionWithLookupsOutput extends createZodDto(TransactionWithLookupsApiSchema) {}
export class UpdateTransactionBody extends createZodDto(UpdateTransactionApiSchema) {}
