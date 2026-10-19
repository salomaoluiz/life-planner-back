import { z } from 'zod';

import { AccessibleOwnersSchema, CalendarDateSchema } from '@finance/application/dto/FinanceCommon';
import { InstallmentEditScope } from '@finance/domain/enum';

export const DeleteOccurrenceSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  confirmPaid: z.boolean().optional(),
  occurrenceNumber: z.number().int().min(1),
  recurrenceId: z.string().min(1),
  scope: z.enum(InstallmentEditScope),
  today: CalendarDateSchema,
});
export const DeleteRecurrenceSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  confirmPaid: z.boolean().optional(),
  id: z.string().min(1),
});

export type DeleteOccurrenceInput = z.input<typeof DeleteOccurrenceSchema>;
export type DeleteRecurrenceInput = z.input<typeof DeleteRecurrenceSchema>;
