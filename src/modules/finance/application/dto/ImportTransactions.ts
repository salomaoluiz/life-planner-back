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
  // Spec 048: the invoice month (`YYYY-MM`) of a card row; checked by the use case.
  invoiceMonth: z.string().nullish(),
  line: z.number().int().min(1),
  // Spec 059: optional note of a normal transaction; checked by the use case.
  notes: z.string().nullish(),
  // Spec 047: the owner of this row; omitted rows take the owner of the request.
  owner: OwnerTypeSchema.nullish(),
  ownerId: z.string().min(1).nullish(),
  paid: z.boolean().nullish(),
  // Spec 048: the account debited by an early payment or an invoice payment.
  paidFromAccountId: z.string().min(1).nullish(),
  tags: z.array(z.string()).nullish(),
  type: TransactionTypeSchema,
  value: z.number(),
});

export const ImportTransactionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  dryRun: z.boolean(),
  // Spec 048: lines flagged as duplicates that the user chose to import; they count in the invoice math.
  includeDuplicates: z.array(z.number().int()).optional(),
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
  rows: z.array(ImportRowSchema).min(1).max(MAX_IMPORT_ROWS),
  // The caller's local day: the default paid status of account rows.
  today: CalendarDateSchema,
});

export type ImportRow = z.infer<typeof ImportRowSchema>;
export type ImportTransactionsInput = z.input<typeof ImportTransactionsSchema>;
