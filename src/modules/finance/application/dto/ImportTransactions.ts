import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TransactionTypeSchema,
} from '@finance/application/dto/FinanceCommon';

export const MAX_IMPORT_ROWS = 2000;

// Spec 047 §7: the rows are checked one by one by the use case (a bad row is an error line, never a failed request),
// so the fields stay as loose as the transport allows.
export const ImportRowSchema = z.object({
  accountId: z.string().min(1).nullish(),
  categoryId: z.string().min(1),
  creditCardId: z.string().min(1).nullish(),
  currency: z.string().nullish(),
  date: z.string(),
  description: z.string(),
  line: z.number().int().min(1),
  paid: z.boolean().nullish(),
  tags: z.array(z.string()).nullish(),
  type: TransactionTypeSchema,
  value: z.number(),
});

export const ImportTransactionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  dryRun: z.boolean(),
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  rows: z.array(ImportRowSchema).min(1).max(MAX_IMPORT_ROWS),
  // The caller's local day: the default paid status of account rows.
  today: CalendarDateSchema,
});

export type ImportRow = z.infer<typeof ImportRowSchema>;
export type ImportTransactionsInput = z.input<typeof ImportTransactionsSchema>;
