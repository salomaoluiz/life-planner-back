import { z } from 'zod';

import {
  CalendarDateSchema,
  DescriptionSchema,
  INT4_MAX,
  INT4_MIN,
  InvoiceMonthSchema,
  NotesSchema,
  TagNamesSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';
import { SystemCategoryKey } from '@finance/domain/enum';

// Spec 119 section 7: a part names its category by id, or by `systemKey: SPLIT_ADJUSTMENT` (the discount/extra charge).
// The value is a non-zero integer; the sign rule (only the adjustment may be negative) is a domain rule (422).
export const SplitPartSchema = z
  .strictObject({
    categoryId: z.string().min(1).optional(),
    description: DescriptionSchema.nullish(),
    id: z.string().min(1).optional(),
    systemKey: z.literal(SystemCategoryKey.SPLIT_ADJUSTMENT).optional(),
    tags: TagNamesSchema.optional(),
    type: TransactionTypeSchema,
    value: z.number().int().min(INT4_MIN).max(INT4_MAX),
  })
  .refine((part) => (part.categoryId === undefined) !== (part.systemKey === undefined), {
    message: 'Send either categoryId or systemKey',
  });

export const SplitSharedShape = {
  accountId: z.string().min(1).optional(),
  creditCardId: z.string().min(1).optional(),
  date: CalendarDateSchema,
  description: DescriptionSchema,
  // Spec 095: card splits only; previous, computed or next invoice of the date.
  invoiceMonth: InvoiceMonthSchema.optional(),
  notes: NotesSchema.optional(),
  paid: z.boolean().optional(),
  parts: z.array(SplitPartSchema),
  // FR 14: what left (or entered) the account; the net of the parts must equal it.
  total: z.number().int().min(1).max(INT4_MAX).optional(),
};
export type SplitPartInput = z.infer<typeof SplitPartSchema>;
