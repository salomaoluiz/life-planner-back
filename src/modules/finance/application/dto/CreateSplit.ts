import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  CurrencySchema,
} from '@finance/application/dto/FinanceCommon';
import { SplitSharedShape } from '@finance/application/dto/SplitCommon';

export const CreateSplitSchema = z.object({
  ...SplitSharedShape,
  accessibleOwners: AccessibleOwnersSchema,
  currency: CurrencySchema.optional(),
  // FR 16: a saved simple transaction becomes the first part.
  fromTransactionId: z.string().min(1).nullish(),
  requesterId: z.string().min(1),
  // Local calendar day of the caller: a new account split starts paid when dated up to today (spec 033 FR 4).
  today: CalendarDateSchema.optional(),
});

export type CreateSplitInput = z.input<typeof CreateSplitSchema>;
