import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  InvoiceMonthSchema,
  TransactionFilterSchema,
} from '@finance/application/dto/FinanceCommon';
import { RecurrenceStatus } from '@finance/domain/enum';

export const GetProjectionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // Spec 045: category, tag, account, card and text filters (the months stay in `from`/`to`).
  filter: TransactionFilterSchema.optional(),
  from: InvoiceMonthSchema,
  ownerIds: z.array(z.string()).optional(),
  to: InvoiceMonthSchema,
  today: CalendarDateSchema,
});
export const GetRecurrenceSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  today: CalendarDateSchema,
});
export const GetRecurrencesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  accountId: z.string().min(1).optional(),
  creditCardId: z.string().min(1).optional(),
  ownerIds: z.array(z.string()).optional(),
  status: z.enum(RecurrenceStatus).optional(),
});

export type GetProjectionsInput = z.input<typeof GetProjectionsSchema>;
export type GetRecurrenceInput = z.input<typeof GetRecurrenceSchema>;
export type GetRecurrencesInput = z.input<typeof GetRecurrencesSchema>;
