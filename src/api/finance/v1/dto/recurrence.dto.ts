import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  CurrencyApiSchema,
  DescriptionApiSchema,
  hasAtLeastOneField,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  TagNamesApiSchema,
  TransactionTypeApiSchema,
  ValueApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { TagRefApiSchema } from '@api/finance/v1/dto/tag.dto';
import { TransactionApiSchema } from '@api/finance/v1/dto/transaction.dto';
import { IdListQuerySchema, SearchQuerySchema } from '@api/finance/v1/finance-query';
import { InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { InstallmentEditScope, RecurrenceFrequency, RecurrenceStatus } from '@finance/domain/enum';

const FrequencyApiSchema = z.enum(RecurrenceFrequency);

// `today` is the caller's local day (query), `paid` applies to occurrence 1 of an account series only.
export const CreateRecurrenceApiSchema = z
  .object({
    accountId: z.uuid().optional(),
    categoryId: z.uuid(),
    creditCardId: z.uuid().optional(),
    currency: CurrencyApiSchema.optional(),
    date: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    endDate: CalendarDateApiSchema.optional(),
    frequency: FrequencyApiSchema,
    owner: OwnerTypeApiSchema,
    ownerId: OwnerIdApiSchema,
    paid: z.boolean().optional(),
    tags: TagNamesApiSchema.optional(),
    type: TransactionTypeApiSchema,
    value: ValueApiSchema,
  })
  .strict()
  .refine((value) => (value.accountId === undefined) !== (value.creditCardId === undefined), {
    message: 'Send either accountId or creditCardId',
  })
  .refine((value) => value.endDate === undefined || value.endDate >= value.date, {
    message: 'endDate must not be before the first date',
    path: ['endDate'],
  });

// Scope ALL (spec 034 FR 20).
export const UpdateRecurrenceApiSchema = z
  .object({
    categoryId: z.uuid(),
    description: DescriptionApiSchema,
    endDate: CalendarDateApiSchema.nullable(),
    tags: TagNamesApiSchema,
    value: ValueApiSchema,
  })
  .partial()
  .strict()
  .refine(hasAtLeastOneField, { message: 'At least one field is required' });

// Scope THIS_AND_NEXT (FR 22).
export const SplitRecurrenceApiSchema = z
  .object({
    accountId: z.uuid(),
    categoryId: z.uuid(),
    creditCardId: z.uuid(),
    description: DescriptionApiSchema,
    endDate: CalendarDateApiSchema.nullable(),
    frequency: FrequencyApiSchema,
    occurrenceNumber: z.number().int().min(1),
    tags: TagNamesApiSchema,
    value: ValueApiSchema,
  })
  .partial()
  .required({ occurrenceNumber: true })
  .strict()
  .refine((value) => value.accountId === undefined || value.creditCardId === undefined, {
    message: 'Send either accountId or creditCardId',
  });

// Edits of a projected occurrence that becomes real (FR 21).
export const MaterializeOccurrenceApiSchema = z
  .object({
    categoryId: z.uuid(),
    date: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    paid: z.boolean(),
    scope: z.literal(InstallmentEditScope.ONLY_THIS),
    tags: TagNamesApiSchema,
    value: ValueApiSchema,
  })
  .partial()
  .strict();

const ConfirmPaidQuerySchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const DeleteOccurrenceQuerySchema = z.object({
  confirmPaid: ConfirmPaidQuerySchema,
  scope: z.enum(InstallmentEditScope),
  today: CalendarDateApiSchema.optional(),
});
export const DeleteRecurrenceQuerySchema = z.object({ confirmPaid: ConfirmPaidQuerySchema });
// `from`/`to` are months here, so the date-period and paid filters of spec 045 do not apply.
export const ProjectionsQuerySchema = z.object({
  accountId: IdListQuerySchema,
  categoryId: IdListQuerySchema,
  creditCardId: IdListQuerySchema,
  from: InvoiceMonthSchema,
  ownerId: z.union([z.uuid(), z.array(z.uuid())]).optional(),
  q: SearchQuerySchema,
  tagId: IdListQuerySchema,
  to: InvoiceMonthSchema,
  today: CalendarDateApiSchema.optional(),
});
export const ListRecurrencesQuerySchema = z.object({
  accountId: z.uuid().optional(),
  creditCardId: z.uuid().optional(),
  ownerId: z.union([z.uuid(), z.array(z.uuid())]).optional(),
  status: z.enum(RecurrenceStatus).optional(),
});

export const RecurrenceApiSchema = z.object({
  account: TransactionApiSchema.shape.account,
  accountId: z.uuid().nullable(),
  category: TransactionApiSchema.shape.category,
  categoryId: z.uuid(),
  creditCard: TransactionApiSchema.shape.creditCard,
  creditCardId: z.uuid().nullable(),
  currency: CurrencyApiSchema,
  description: z.string(),
  endDate: z.string().nullable(),
  firstNumber: z.number().int(),
  frequency: FrequencyApiSchema,
  id: z.uuid(),
  nextOccurrenceDate: z.string().nullable(),
  occurrenceCount: z.number().int().nullable(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  startDate: z.string(),
  status: z.enum(RecurrenceStatus),
  tags: z.array(TagRefApiSchema),
  type: TransactionTypeApiSchema,
  value: z.number().int(),
});
export const ProjectedOccurrenceApiSchema = z.object({
  account: TransactionApiSchema.shape.account,
  category: TransactionApiSchema.shape.category,
  creditCard: TransactionApiSchema.shape.creditCard,
  currency: CurrencyApiSchema,
  date: z.string(),
  description: z.string(),
  frequency: FrequencyApiSchema,
  invoiceListDate: z.string().nullable(),
  invoiceMonth: z.string().nullable(),
  occurrenceCount: z.number().int().nullable(),
  occurrenceNumber: z.number().int(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  recurrenceId: z.uuid(),
  tags: z.array(TagRefApiSchema),
  type: TransactionTypeApiSchema,
  value: z.number().int(),
});
export const CreateRecurrenceResultApiSchema = z.object({
  occurrences: z.array(TransactionApiSchema),
  overLimit: z.boolean(),
  recurrence: RecurrenceApiSchema,
});
export const RecurrenceDetailsApiSchema = z.object({
  occurrences: z.array(TransactionApiSchema),
  projected: z.array(ProjectedOccurrenceApiSchema),
  recurrence: RecurrenceApiSchema,
});
export const SplitRecurrenceResultApiSchema = z.object({
  ended: RecurrenceApiSchema.nullable(),
  occurrences: z.array(TransactionApiSchema),
  recurrence: RecurrenceApiSchema,
});
export const DeleteRecurrenceResultApiSchema = z.object({
  deleted: z.number().int(),
  detached: z.number().int(),
});

export type CreateRecurrenceApiInput = z.infer<typeof CreateRecurrenceApiSchema>;
export type MaterializeOccurrenceApiInput = z.infer<typeof MaterializeOccurrenceApiSchema>;
export type RecurrenceOutputShape = z.infer<typeof RecurrenceApiSchema>;
export type SplitRecurrenceApiInput = z.infer<typeof SplitRecurrenceApiSchema>;
export type UpdateRecurrenceApiInput = z.infer<typeof UpdateRecurrenceApiSchema>;

export class CreateRecurrenceBody extends createZodDto(CreateRecurrenceApiSchema) {}
export class CreateRecurrenceResultOutput extends createZodDto(CreateRecurrenceResultApiSchema) {}
export class DeleteRecurrenceResultOutput extends createZodDto(DeleteRecurrenceResultApiSchema) {}
export class MaterializeOccurrenceBody extends createZodDto(MaterializeOccurrenceApiSchema) {}
export class ProjectedOccurrenceOutput extends createZodDto(ProjectedOccurrenceApiSchema) {}
export class RecurrenceDetailsOutput extends createZodDto(RecurrenceDetailsApiSchema) {}
export class RecurrenceOutput extends createZodDto(RecurrenceApiSchema) {}
export class SplitRecurrenceBody extends createZodDto(SplitRecurrenceApiSchema) {}
export class SplitRecurrenceResultOutput extends createZodDto(SplitRecurrenceResultApiSchema) {}
export class UpdateRecurrenceBody extends createZodDto(UpdateRecurrenceApiSchema) {}
