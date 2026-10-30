import { z } from 'zod';

import { isPeriodValid } from '@finance/domain/entity/TransactionFilter';
import { TransactionType } from '@finance/domain/enum';
import { SUPPORTED_CURRENCIES } from '@finance/domain/enum/Currency';
import { normalizeNotes, NOTES_MAX } from '@finance/domain/service/Notes';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export const INT4_MAX = 2147483647;
export const INT4_MIN = -2147483648;

// `YYYY-MM-DD` that is also a real calendar day (rejects 2026-02-30, 2026-13-01, 2026-10-3 and timestamps).
function isValidCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const AccessibleOwnersSchema = z.array(
  z.object({
    archived: z.boolean().optional(),
    owner: z.enum(OwnerType),
    ownerId: z.string().min(1),
  }),
);
// Category scope `ALL` (spec 038): the creator's Personal scope plus every family they are in.
export const ALL_SCOPES = 'ALL';
export const BalanceSchema = z.number().int().min(INT4_MIN).max(INT4_MAX);
export const CurrencySchema = z.enum(SUPPORTED_CURRENCIES);
export const IconSchema = z.string().trim().min(1).max(50);
export const NameSchema = z.string().trim().min(1).max(60);
export const OwnerIdSchema = z.string().min(1);
export const OwnerTypeSchema = z.enum(OwnerType);
export const IconColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
// Spec 043 FR 1/4: 1-30 characters after trimming, at most 10 per record.
export const TagNameSchema = z.string().trim().min(1).max(30);
export const TagNamesSchema = z.array(TagNameSchema).max(10);
export const TransactionTypeSchema = z.enum(TransactionType);
export const CalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidCalendarDate, { message: 'Invalid calendar date' });
export const DescriptionSchema = z.string().trim().min(1).max(200);
// Spec 059: optional free text; `null` or empty clears it, absent leaves it (on update). Trimmed length <= 1000.
export const NotesSchema = z
  .string()
  .trim()
  .max(NOTES_MAX)
  .nullable()
  .transform((value) => normalizeNotes(value));
// Integer cents, strictly positive (the sign comes from the type), max int4.
export const ValueSchema = z.number().int().min(1).max(INT4_MAX);

// `YYYY-MM`
export const InvoiceMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// Spec 045: the filters shared by the transactions, invoices and projections lists.
export const TransactionFilterSchema = z
  .object({
    accountIds: z.array(z.string().min(1)).optional(),
    categoryIds: z.array(z.string().min(1)).optional(),
    creditCardIds: z.array(z.string().min(1)).optional(),
    from: CalendarDateSchema.optional(),
    paid: z.boolean().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    tagIds: z.array(z.string().min(1)).optional(),
    to: CalendarDateSchema.optional(),
  })
  .refine((value) => (value.from === undefined) === (value.to === undefined), {
    message: 'from and to go together',
  })
  .refine((value) => !value.from || !value.to || isPeriodValid(value.from, value.to), {
    message: 'The period can be at most 2 years',
  });
