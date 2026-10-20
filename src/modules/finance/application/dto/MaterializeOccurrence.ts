import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  TagNamesSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';

export const MaterializeOccurrenceSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  categoryId: z.string().min(1).optional(),
  date: CalendarDateSchema.optional(),
  description: DescriptionSchema.optional(),
  occurrenceNumber: z.number().int().min(1),
  // Account series only.
  paid: z.boolean().optional(),
  recurrenceId: z.string().min(1),
  tags: TagNamesSchema.optional(),
  today: CalendarDateSchema,
  value: ValueSchema.optional(),
});

export type MaterializeOccurrenceInput = z.input<typeof MaterializeOccurrenceSchema>;
