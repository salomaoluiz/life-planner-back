import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';
import { RecurrenceFrequency } from '@finance/domain/enum';

// Scope ALL (spec 034 FR 20): description, category, value and end date of the whole series.
export const UpdateRecurrenceSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  categoryId: z.string().min(1).optional(),
  description: DescriptionSchema.optional(),
  // `null` removes the end date.
  endDate: CalendarDateSchema.nullable().optional(),
  id: z.string().min(1),
  today: CalendarDateSchema,
  value: ValueSchema.optional(),
});

// Scope THIS_AND_NEXT (FR 22): the series splits at `occurrenceNumber`.
export const SplitRecurrenceSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    creditCardId: z.string().min(1).optional(),
    description: DescriptionSchema.optional(),
    endDate: CalendarDateSchema.nullable().optional(),
    frequency: z.enum(RecurrenceFrequency).optional(),
    id: z.string().min(1),
    occurrenceNumber: z.number().int().min(1),
    today: CalendarDateSchema,
    value: ValueSchema.optional(),
  })
  .refine((input) => input.accountId === undefined || input.creditCardId === undefined, {
    message: 'Send either accountId or creditCardId',
  });

export type SplitRecurrenceInput = z.input<typeof SplitRecurrenceSchema>;
export type UpdateRecurrenceInput = z.input<typeof UpdateRecurrenceSchema>;
