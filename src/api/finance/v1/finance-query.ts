import { z } from 'zod';

import { CalendarDateApiSchema } from '@api/finance/v1/dto/finance-fields';
import {
  hasFilter,
  isPeriodValid,
  TransactionFilter,
} from '@finance/domain/entity/TransactionFilter';

// `?ownerId=a` arrives as a string, `?ownerId=a&ownerId=b` as an array.
export const OwnerIdQuerySchema = z.union([z.uuid(), z.array(z.uuid())]).optional();

export function toOwnerIds(ownerId?: string | string[]): string[] | undefined {
  if (ownerId === undefined) {
    return undefined;
  }

  return Array.isArray(ownerId) ? ownerId : [ownerId];
}

// `?today=2026-10-15`: the client's local calendar date; invalid → 400 through `validate`.
export const TodayQuerySchema = z.object({ today: CalendarDateApiSchema.optional() });

// A missing `today` means the server's UTC date (spec 028 FR 6).
export function resolveToday(today?: string): string {
  return today ?? new Date().toISOString().slice(0, 10);
}

// Spec 045: `?categoryId=a&categoryId=b` arrives as an array, `?categoryId=a` as a string.
export const IdListQuerySchema = z.union([z.uuid(), z.array(z.uuid())]).optional();
// Whitespace-only text is no filter; more than 100 characters is a 400.
export const SearchQuerySchema = z
  .string()
  .max(300)
  .transform((value) => value.trim())
  .pipe(z.string().max(100))
  .optional();

export const TransactionFilterQueryFields = {
  accountId: IdListQuerySchema,
  categoryId: IdListQuerySchema,
  creditCardId: IdListQuerySchema,
  from: CalendarDateApiSchema.optional(),
  paid: z.enum(['true', 'false']).optional(),
  q: SearchQuerySchema,
  tagId: IdListQuerySchema,
  to: CalendarDateApiSchema.optional(),
};

export const TransactionFilterQuerySchema = withPeriodRules(z.object(TransactionFilterQueryFields));

// `from` and `to` go together and are at most 2 years apart (spec 045 §7).
export type TransactionFilterQuery = z.infer<typeof TransactionFilterQuerySchema>;

export function withPeriodRules<T extends z.ZodType<{ from?: string; to?: string }>>(schema: T) {
  return schema
    .refine((value) => (value.from === undefined) === (value.to === undefined), {
      message: 'from and to go together',
    })
    .refine((value) => !value.from || !value.to || isPeriodValid(value.from, value.to), {
      message: 'The period can be at most 2 years',
    });
}

// `undefined` when the request carries no filter at all.
export function toTransactionFilter(query: TransactionFilterQuery): TransactionFilter | undefined {
  const filter: TransactionFilter = {
    accountIds: toOwnerIds(query.accountId),
    categoryIds: toOwnerIds(query.categoryId),
    creditCardIds: toOwnerIds(query.creditCardId),
    from: query.from,
    paid: query.paid === undefined ? undefined : query.paid === 'true',
    q: query.q === '' ? undefined : query.q,
    tagIds: toOwnerIds(query.tagId),
    to: query.to,
  };

  return hasFilter(filter) ? filter : undefined;
}
