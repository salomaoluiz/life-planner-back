import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  CurrencySchema,
  DescriptionSchema,
  NotesSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TagNamesSchema,
  TransactionTypeSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';
import { RecurrenceFrequency } from '@finance/domain/enum';

export const CreateRecurrenceSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1),
    creditCardId: z.string().min(1).optional(),
    currency: CurrencySchema.optional(),
    // Date of occurrence 1.
    date: CalendarDateSchema,
    description: DescriptionSchema,
    notes: NotesSchema.optional(),
    // Inclusive; omitted = runs until the user ends it.
    endDate: CalendarDateSchema.optional(),
    frequency: z.enum(RecurrenceFrequency),
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    // Occurrence 1 of an account series only; omitted → paid when dated up to `today` (spec 033 FR 4).
    paid: z.boolean().optional(),
    // Spec 043 FR 11: stored on the series and copied to every occurrence.
    tags: TagNamesSchema.optional(),
    today: CalendarDateSchema,
    type: TransactionTypeSchema,
    value: ValueSchema,
  })
  .refine((input) => (input.accountId === undefined) !== (input.creditCardId === undefined), {
    message: 'Send either accountId or creditCardId',
  })
  .refine((input) => input.endDate === undefined || input.endDate >= input.date, {
    message: 'endDate must not be before the first date',
    path: ['endDate'],
  });

export type CreateRecurrenceInput = z.input<typeof CreateRecurrenceSchema>;
