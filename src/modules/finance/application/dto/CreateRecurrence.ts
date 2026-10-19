import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
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
    // Date of occurrence 1.
    date: CalendarDateSchema,
    description: DescriptionSchema,
    // Inclusive; omitted = runs until the user ends it.
    endDate: CalendarDateSchema.optional(),
    frequency: z.enum(RecurrenceFrequency),
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    // Occurrence 1 of an account series only; omitted → paid when dated up to `today` (spec 033 FR 4).
    paid: z.boolean().optional(),
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
