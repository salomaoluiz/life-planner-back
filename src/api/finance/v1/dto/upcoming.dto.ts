import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CalendarDateApiSchema, OwnerTypeApiSchema } from '@api/finance/v1/dto/finance-fields';
import { OwnerIdQuerySchema } from '@api/finance/v1/finance-query';
import { TransactionType } from '@finance/domain/enum';
import { SUPPORTED_CURRENCIES } from '@finance/domain/enum/Currency';

// Spec 062 §7: `ownerId` is required (the home always sends its filter), `days` 1-31 and `limit` 1-20.
export const UpcomingQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(31).default(7),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  ownerId: OwnerIdQuerySchema.refine((value) => value !== undefined, {
    message: 'ownerId is required',
  }),
  today: CalendarDateApiSchema.optional(),
});

const UpcomingItemApiSchema = z.object({
  accountId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  creditCardId: z.uuid().nullable(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  date: z.string(),
  description: z.string(),
  // A transaction id, `<cardId>:<YYYY-MM>` for an invoice or `<recurrenceId>:<occurrence>` for a projection.
  id: z.string(),
  invoiceMonth: z.string().nullable(),
  kind: z.enum(['INVOICE', 'PROJECTION', 'TRANSACTION']),
  occurrenceNumber: z.number().int().nullable(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  projectedAmount: z.number().int().optional(),
  purchaseCount: z.number().int().nullable(),
  recurrenceId: z.uuid().nullable(),
  type: z.enum(TransactionType),
  valueCents: z.number().int(),
});

export const UpcomingApiSchema = z.object({
  next: z.array(UpcomingItemApiSchema),
  nextTotal: z.number().int(),
  overdue: z.array(UpcomingItemApiSchema),
  overdueTotals: z.object({ expenseCents: z.number().int(), incomeCents: z.number().int() }),
});

export class UpcomingOutput extends createZodDto(UpcomingApiSchema) {}
