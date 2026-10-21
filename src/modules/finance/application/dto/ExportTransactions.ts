import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  OwnerIdSchema,
} from '@finance/application/dto/FinanceCommon';
import { isPeriodValid } from '@finance/domain/entity/TransactionFilter';

// Spec 047 §7: `ALL` reaches every owner of the caller, archived families included.
export const ExportScopeSchema = z.enum(['ALL', 'FAMILY', 'USER']);

const ExportQueryFields = {
  accessibleOwners: AccessibleOwnersSchema,
  accountIds: z.array(z.string().min(1)).optional(),
  creditCardIds: z.array(z.string().min(1)).optional(),
  from: CalendarDateSchema,
  owner: ExportScopeSchema.default('ALL'),
  ownerId: OwnerIdSchema.optional(),
  to: CalendarDateSchema,
};

function periodRule<T extends z.ZodType<{ from: string; to: string }>>(schema: T) {
  return schema.refine((value) => isPeriodValid(value.from, value.to), {
    message: 'The period can be at most 2 years',
  });
}

export const CountExportTransactionsSchema = periodRule(z.object(ExportQueryFields));

export const ExportTransactionsSchema = periodRule(
  z.object({
    ...ExportQueryFields,
    format: z.enum(['BR', 'INTL']),
    lang: z.enum(['en-US', 'pt-BR']),
    // Family names by id, resolved by the api layer (finance never calls the family module).
    ownerNames: z.record(z.string(), z.string()).default({}),
    // The caller's local day: card rows resolve their paid status from the invoice.
    today: CalendarDateSchema,
  }),
);

export type CountExportTransactionsInput = z.input<typeof CountExportTransactionsSchema>;
export type ExportTransactionsInput = z.input<typeof ExportTransactionsSchema>;
