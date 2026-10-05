import { z } from 'zod';

import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export const INT4_MAX = 2147483647;
export const INT4_MIN = -2147483648;

// `YYYY-MM-DD` that is also a real calendar day (rejects 2026-02-30, 2026-13-01, 2026-10-3 and timestamps).
function isValidCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const AccessibleOwnersSchema = z.array(
  z.object({ owner: z.enum(OwnerType), ownerId: z.string().min(1) }),
);
export const BalanceSchema = z.number().int().min(INT4_MIN).max(INT4_MAX);
export const IconSchema = z.string().trim().min(1).max(50);
export const NameSchema = z.string().trim().min(1).max(60);
export const OwnerIdSchema = z.string().min(1);
export const OwnerTypeSchema = z.enum(OwnerType);
export const IconColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const TransactionTypeSchema = z.enum(TransactionType);
export const CalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidCalendarDate, { message: 'Invalid calendar date' });
export const DescriptionSchema = z.string().trim().min(1).max(200);
// Integer cents, strictly positive (the sign comes from the type), max int4.
export const ValueSchema = z.number().int().min(1).max(INT4_MAX);
