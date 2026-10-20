import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  CurrencyApiSchema,
  DescriptionApiSchema,
  hasAtLeastOneField,
  IconColorApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  TagNamesApiSchema,
  TransactionTypeApiSchema,
  ValueApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { TagRefApiSchema } from '@api/finance/v1/dto/tag.dto';
import { InstallmentEditScope, RecurrenceFrequency, SystemCategoryKey } from '@finance/domain/enum';

const TransactionFieldsSchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid(),
  creditCardId: z.uuid(),
  date: CalendarDateApiSchema,
  description: DescriptionApiSchema,
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
  paid: true,
  tags: true,
})
  .extend({ currency: CurrencyApiSchema.optional() })
  .refine((value) => (value.accountId === undefined) !== (value.creditCardId === undefined), {
    message: 'Send either accountId or creditCardId',
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
  // Only on create / update responses of card purchases: the purchase left the card over its limit.
  overLimit: z.boolean().optional(),
  // Series position / total (null without end date) / id / frequency; all null outside a recurring series.
  occurrenceCount: z.number().int().nullable(),
  occurrenceNumber: z.number().int().nullable(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  // Stored for account rows; derived from the invoice for card rows.
  paid: z.boolean(),
  recurrenceFrequency: z.enum(RecurrenceFrequency).nullable(),
  recurrenceId: z.uuid().nullable(),
  tags: z.array(TagRefApiSchema),
  type: TransactionTypeApiSchema,
  updatedAt: z.iso.datetime(),
  value: z.number().int(),
});

export type CreateTransactionApiInput = z.infer<typeof CreateTransactionApiSchema>;
export type UpdateTransactionApiInput = z.infer<typeof UpdateTransactionApiSchema>;

export class CreateTransactionBody extends createZodDto(CreateTransactionApiSchema) {}
export class TransactionOutput extends createZodDto(TransactionApiSchema) {}
export class UpdateTransactionBody extends createZodDto(UpdateTransactionApiSchema) {}
