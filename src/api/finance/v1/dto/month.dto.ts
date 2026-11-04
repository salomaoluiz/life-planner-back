import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DailyBalancesApiSchema } from '@api/finance/v1/dto/account.dto';
import { InvoiceDetailApiSchema } from '@api/finance/v1/dto/invoice.dto';
import { ProjectedOccurrenceApiSchema } from '@api/finance/v1/dto/recurrence.dto';
import {
  TransactionItemApiSchema,
  TransactionLookupsApiSchema,
} from '@api/finance/v1/dto/transaction.dto';
import {
  IdListQuerySchema,
  OwnerIdQuerySchema,
  SearchQuerySchema,
  TodayQuerySchema,
} from '@api/finance/v1/finance-query';
import { InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';

// Spec 080: the month is the period, so the filters of spec 045 come without `from`/`to`.
export const MonthQuerySchema = z
  .object({
    accountId: IdListQuerySchema,
    categoryId: IdListQuerySchema,
    creditCardId: IdListQuerySchema,
    month: InvoiceMonthSchema,
    ownerId: OwnerIdQuerySchema,
    paid: z.enum(['true', 'false']).optional(),
    q: SearchQuerySchema,
    tagId: IdListQuerySchema,
  })
  .extend(TodayQuerySchema.shape)
  .strict();

export const MonthSummaryApiSchema = z.object({
  currency: z.literal('BRL'),
  expense: z.number().int(),
  income: z.number().int(),
  projectedExpense: z.number().int(),
  projectedIncome: z.number().int(),
  toPay: z.number().int(),
  toReceive: z.number().int(),
});

export const MonthApiSchema = z.object({
  dailyBalances: DailyBalancesApiSchema,
  invoices: z.array(InvoiceDetailApiSchema),
  lookups: TransactionLookupsApiSchema,
  month: z.string(),
  projections: z.array(ProjectedOccurrenceApiSchema),
  rows: z.object({
    items: z.array(TransactionItemApiSchema),
    nextCursor: z.string().nullable(),
  }),
  summary: MonthSummaryApiSchema,
});

export type MonthOutputShape = z.infer<typeof MonthApiSchema>;
export type MonthQuery = z.infer<typeof MonthQuerySchema>;

export class MonthOutput extends createZodDto(MonthApiSchema) {}
