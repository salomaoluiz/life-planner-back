import { z } from 'zod';

import { RecurrenceFrequency } from '@finance/domain/enum';
import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  NotesSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';

// Spec 098 section 7. `amountIn` may be omitted for the same currency (filled) and for a series occurrence.
export const CreateTransferSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    amountIn: ValueSchema.nullish(),
    amountOut: ValueSchema,
    dateIn: CalendarDateSchema.optional(),
    dateOut: CalendarDateSchema,
    description: DescriptionSchema,
    fee: ValueSchema.nullish(),
    fromAccountId: z.string().min(1),
    notes: NotesSchema.optional(),
    // Set only by the recurrence materialization.
    occurrenceNumber: z.number().int().positive().nullish(),
    paid: z.boolean(),
    // Spec 098 FR 8: a transfer series; `dateOut` is the date of occurrence 1.
    recurrence: z
      .object({ endDate: CalendarDateSchema.optional(), frequency: z.enum(RecurrenceFrequency) })
      .optional(),
    recurrenceId: z.string().min(1).nullish(),
    requesterId: z.string().min(1),
    toAccountId: z.string().min(1),
    today: CalendarDateSchema.optional(),
  })
  .refine(
    (input) => input.recurrence?.endDate === undefined || input.recurrence.endDate >= input.dateOut,
    {
      message: 'endDate must not be before the first date',
      path: ['recurrence', 'endDate'],
    },
  );

export type CreateTransferInput = z.input<typeof CreateTransferSchema>;
