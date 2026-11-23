import { z } from 'zod';

import { AccessibleOwnersSchema, CalendarDateSchema } from '@finance/application/dto/FinanceCommon';
import { SplitSharedShape } from '@finance/application/dto/SplitCommon';

// FR 18-19: the full replacement (shared fields + parts) or only `{ paid }`.
export const UpdateSplitSchema = z
  .object({
    ...SplitSharedShape,
    accessibleOwners: AccessibleOwnersSchema,
    date: SplitSharedShape.date.optional(),
    description: SplitSharedShape.description.optional(),
    fromStockPurchase: z.boolean().optional(),
    id: z.string().min(1),
    parts: SplitSharedShape.parts.optional(),
    today: CalendarDateSchema.optional(),
  })
  .refine((input) => input.parts !== undefined || input.paid !== undefined, {
    message: 'Send the parts or paid',
  });

export type UpdateSplitInput = z.input<typeof UpdateSplitSchema>;
