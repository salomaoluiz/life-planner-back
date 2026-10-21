import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  OwnerIdApiSchema,
  OwnerTypeApiSchema,
  TransactionTypeApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import { IdListQuerySchema, withPeriodRules } from '@api/finance/v1/finance-query';

// Spec 047 §7: `from`/`to` are required here (and at most 2 years apart, as in spec 045).
const ExportCountQueryFields = {
  accountId: IdListQuerySchema,
  creditCardId: IdListQuerySchema,
  from: CalendarDateApiSchema,
  owner: z.enum(['ALL', 'FAMILY', 'USER']).default('ALL'),
  ownerId: OwnerIdApiSchema.optional(),
  to: CalendarDateApiSchema,
  today: CalendarDateApiSchema.optional(),
};

export const ExportCountQuerySchema = withPeriodRules(z.object(ExportCountQueryFields)).refine(
  (value) => value.owner !== 'FAMILY' || value.ownerId !== undefined,
  { message: 'ownerId is required for a family' },
);

export const ExportQuerySchema = withPeriodRules(
  z.object({
    ...ExportCountQueryFields,
    format: z.enum(['BR', 'INTL']),
    lang: z.enum(['en-US', 'pt-BR']).default('en-US'),
  }),
).refine((value) => value.owner !== 'FAMILY' || value.ownerId !== undefined, {
  message: 'ownerId is required for a family',
});

export const ExportCountOutputSchema = z.object({ count: z.number().int().min(0) });

// Spec 047 §7: 1-2,000 rows, `value` in positive integer cents, exactly one of `accountId`/`creditCardId`.
// Row-level problems are answered as error lines by the use case, so the row fields only get their types here.
const ImportRowApiSchema = z.object({
  accountId: z.uuid().nullish(),
  categoryId: z.uuid(),
  creditCardId: z.uuid().nullish(),
  currency: z.string().nullish(),
  date: z.string(),
  description: z.string(),
  // Spec 048: the invoice month (`YYYY-MM`) of a card row; the use case checks it.
  invoiceMonth: z.string().nullish(),
  line: z.number().int().min(1),
  // The owner of this row (spec 047); omitted rows take the owner of the request.
  owner: OwnerTypeApiSchema.nullish(),
  ownerId: OwnerIdApiSchema.nullish(),
  paid: z.boolean().nullish(),
  // Spec 048: the account an early payment or an invoice payment is paid from.
  paidFromAccountId: z.uuid().nullish(),
  tags: z.array(z.string()).nullish(),
  type: TransactionTypeApiSchema,
  value: z.number(),
});

export const ImportTransactionsApiSchema = z.object({
  dryRun: z.boolean(),
  owner: OwnerTypeApiSchema,
  ownerId: OwnerIdApiSchema,
  rows: z.array(ImportRowApiSchema).min(1).max(2000),
});

export const ImportErrorApiSchema = z.object({
  code: z.string(),
  line: z.number().int(),
  message: z.string(),
  params: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export const ImportDryRunOutputSchema = z.object({
  duplicates: z.array(z.number().int()),
  errors: z.array(ImportErrorApiSchema),
  // Spec 048 FR 24: the invoices the file touches, with the amount due once every row is applied.
  invoices: z.array(
    z.object({
      amountDue: z.number().int(),
      creditCardId: z.string(),
      invoiceMonth: z.string(),
      paid: z.boolean(),
    }),
  ),
});
export const ImportCreatedOutputSchema = z.object({ created: z.number().int().min(0) });

export class ImportCreatedOutput extends createZodDto(ImportCreatedOutputSchema) {}
export class ImportDryRunOutput extends createZodDto(ImportDryRunOutputSchema) {}
export class ImportTransactionsBody extends createZodDto(ImportTransactionsApiSchema) {}
