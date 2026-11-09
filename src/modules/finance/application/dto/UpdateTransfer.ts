import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  DescriptionSchema,
  NotesSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';
import { InstallmentEditScope } from '@finance/domain/enum';

// Every field of the create body is optional; an absent field keeps the stored value, `fee: null` removes the fee.
export const UpdateTransferSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  amountIn: ValueSchema.nullish(),
  amountOut: ValueSchema.optional(),
  dateIn: CalendarDateSchema.optional(),
  dateOut: CalendarDateSchema.optional(),
  description: DescriptionSchema.optional(),
  fee: ValueSchema.nullish(),
  fromAccountId: z.string().min(1).optional(),
  id: z.string().min(1),
  notes: NotesSchema.optional(),
  paid: z.boolean().optional(),
  // Required on an occurrence of a series (spec 034 scopes).
  scope: z.enum(InstallmentEditScope).optional(),
  toAccountId: z.string().min(1).optional(),
});

export type UpdateTransferInput = z.input<typeof UpdateTransferSchema>;
