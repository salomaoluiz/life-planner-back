import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  CurrencyApiSchema,
  DescriptionApiSchema,
  hasAtLeastOneField,
  NotesApiSchema,
  ValueApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { InstallmentEditScope, RecurrenceFrequency } from '@finance/domain/enum';
import {
  TransactionItemApiSchema,
  TransactionLookupsApiSchema,
} from '@api/finance/v1/dto/transaction.dto';

// Spec 098 section 7. `amountIn` is optional for the same currency (the API fills it); `dateIn` defaults to `dateOut`.
export const CreateTransferApiSchema = z.strictObject({
  amountIn: ValueApiSchema.optional(),
  amountOut: ValueApiSchema,
  dateIn: CalendarDateApiSchema.optional(),
  dateOut: CalendarDateApiSchema,
  description: DescriptionApiSchema,
  fee: ValueApiSchema.optional(),
  fromAccountId: z.uuid(),
  notes: NotesApiSchema.optional(),
  paid: z.boolean(),
  // Spec 098 FR 8: a transfer series whose first occurrence is `dateOut`.
  recurrence: z
    .strictObject({
      endDate: CalendarDateApiSchema.optional(),
      frequency: z.enum(RecurrenceFrequency),
    })
    .optional(),
  toAccountId: z.uuid(),
});

// `fee: null` removes the fee; every other absent field keeps the stored value.
export const UpdateTransferApiSchema = z
  .strictObject({
    amountIn: ValueApiSchema,
    amountOut: ValueApiSchema,
    dateIn: CalendarDateApiSchema,
    dateOut: CalendarDateApiSchema,
    description: DescriptionApiSchema,
    fee: ValueApiSchema.nullable(),
    fromAccountId: z.uuid(),
    notes: NotesApiSchema,
    paid: z.boolean(),
    // Required on an occurrence of a series (spec 034 scopes).
    scope: z.enum(InstallmentEditScope),
    toAccountId: z.uuid(),
  })
  .partial()
  .refine(hasAtLeastOneField, { message: 'Send at least one field' });

export const TransferApiSchema = z.strictObject({
  amountIn: z.number().int().nullable(),
  amountOut: z.number().int(),
  currencyIn: CurrencyApiSchema,
  currencyOut: CurrencyApiSchema,
  dateIn: z.string(),
  dateOut: z.string(),
  description: z.string(),
  fee: z.number().int().optional(),
  fromAccountId: z.uuid().optional(),
  id: z.uuid(),
  notes: z.string().optional(),
  occurrenceNumber: z.number().int().optional(),
  paid: z.boolean(),
  // "1 <currency in> = value <currency out>" when `base` is IN; the other way when OUT. Absent while the amount in is unknown.
  rate: z.strictObject({ base: z.enum(['IN', 'OUT']), value: z.number() }).optional(),
  recurrenceId: z.uuid().optional(),
  toAccountId: z.uuid().optional(),
});

export const TransferWithRowsApiSchema = z.strictObject({
  item: TransferApiSchema,
  lookups: TransactionLookupsApiSchema,
  rows: z.array(TransactionItemApiSchema),
});

export type CreateTransferApiInput = z.infer<typeof CreateTransferApiSchema>;
export type TransferOutputItem = z.infer<typeof TransferApiSchema>;
export type TransferWithRows = z.infer<typeof TransferWithRowsApiSchema>;
export type UpdateTransferApiInput = z.infer<typeof UpdateTransferApiSchema>;

export class CreateTransferBody extends createZodDto(CreateTransferApiSchema) {}
export class TransferWithRowsOutput extends createZodDto(TransferWithRowsApiSchema) {}
export class UpdateTransferBody extends createZodDto(UpdateTransferApiSchema) {}
