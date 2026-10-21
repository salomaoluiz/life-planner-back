import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CalendarDateApiSchema } from '@api/finance/v1/dto/finance-fields';
import {
  IdListQuerySchema,
  OwnerIdQuerySchema,
  SearchQuerySchema,
} from '@api/finance/v1/finance-query';
import { TransactionSource, TransactionType } from '@finance/domain/enum';
import { SUPPORTED_CURRENCIES } from '@finance/domain/enum/Currency';
import { isDashboardPeriodValid } from '@finance/domain/service/DashboardPeriod';

// Spec 046 §7: the query every dashboard endpoint shares (period, scope, currency and the 045 filters).
const DashboardQueryFields = {
  accountId: IdListQuerySchema,
  categoryId: IdListQuerySchema,
  creditCardId: IdListQuerySchema,
  currency: z.enum(SUPPORTED_CURRENCIES),
  from: CalendarDateApiSchema,
  ownerId: OwnerIdQuerySchema,
  paid: z.enum(['true', 'false']).optional(),
  q: SearchQuerySchema,
  source: z.enum(TransactionSource).optional(),
  tagId: IdListQuerySchema,
  to: CalendarDateApiSchema,
  today: CalendarDateApiSchema.optional(),
};

// `to` is at most the last day of the current month and the range at most 2 years.
function withDashboardPeriod<T extends z.ZodType<{ from: string; to: string; today?: string }>>(
  schema: T,
) {
  return schema.refine(
    (value) =>
      isDashboardPeriodValid(
        value.from,
        value.to,
        value.today ?? new Date().toISOString().slice(0, 10),
      ),
    { message: 'The period can be at most 2 years and end by the end of the current month' },
  );
}

export const DashboardSummaryQuerySchema = withDashboardPeriod(z.object(DashboardQueryFields));
export const BalanceSeriesQuerySchema = withDashboardPeriod(
  z.object({ ...DashboardQueryFields, granularity: z.enum(['DAY', 'MONTH', 'WEEK']) }),
);
export const TotalsQuerySchema = withDashboardPeriod(
  z
    .object({
      ...DashboardQueryFields,
      groupBy: z.enum(['CATEGORY', 'PERIOD', 'TAG']),
      parentId: z.uuid().optional(),
      type: z.enum(TransactionType).optional(),
    })
    .refine((value) => value.groupBy === 'PERIOD' || value.type !== undefined, {
      message: 'type is required for CATEGORY and TAG',
    }),
);

const AmountsSchema = z.object({
  projected: z.number().int(),
  realized: z.number().int(),
});

export const DashboardSummaryApiSchema = z.object({
  balance: z.object({ current: z.number().int(), previous: z.number().int() }),
  currencies: z.array(
    z.object({
      accounts: z.number().int(),
      cards: z.number().int(),
      code: z.enum(SUPPORTED_CURRENCIES),
    }),
  ),
  currency: z.enum(SUPPORTED_CURRENCIES),
  expense: AmountsSchema.extend({ previous: z.number().int() }),
  income: AmountsSchema.extend({ previous: z.number().int() }),
});

export const BalanceSeriesApiSchema = z.object({
  currency: z.enum(SUPPORTED_CURRENCIES),
  granularity: z.enum(['DAY', 'MONTH', 'WEEK']),
  points: z.array(
    z.object({
      accounts: z.array(z.object({ balance: z.number().int(), id: z.string(), name: z.string() })),
      balance: z.number().int(),
      end: z.string(),
      projected: z.boolean(),
      start: z.string(),
    }),
  ),
});

const PeriodItemSchema = z.object({
  end: z.string(),
  expense: AmountsSchema,
  income: AmountsSchema,
  start: z.string(),
});
const CategoryItemSchema = AmountsSchema.extend({
  archived: z.boolean(),
  categoryId: z.string(),
  count: z.number().int(),
  hasChildren: z.boolean(),
  name: z.string(),
  self: z.boolean(),
});
const TagItemSchema = AmountsSchema.extend({
  count: z.number().int(),
  name: z.string(),
  tagId: z.string(),
});

// One shape for the three groupings (`bucket` only for PERIOD, `total` for CATEGORY and TAG, `untagged` for TAG).
export const TotalsApiSchema = z.object({
  bucket: z.enum(['MONTH', 'WEEK']).optional(),
  groupBy: z.enum(['CATEGORY', 'PERIOD', 'TAG']),
  items: z.array(z.union([PeriodItemSchema, CategoryItemSchema, TagItemSchema])),
  total: z.number().int().optional(),
  untagged: AmountsSchema.extend({ count: z.number().int() }).optional(),
});

export class BalanceSeriesOutput extends createZodDto(BalanceSeriesApiSchema) {}
export class DashboardSummaryOutput extends createZodDto(DashboardSummaryApiSchema) {}
export class TotalsOutput extends createZodDto(TotalsApiSchema) {}
