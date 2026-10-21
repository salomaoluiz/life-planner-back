import { z } from 'zod';

import { TransactionTypeSchema } from '@finance/application/dto/FinanceCommon';
import { DashboardCommonSchema } from '@finance/application/dto/GetDashboardRows';

export const TotalsGroupBy = { CATEGORY: 'CATEGORY', PERIOD: 'PERIOD', TAG: 'TAG' } as const;

export const GetFinanceTotalsSchema = DashboardCommonSchema.extend({
  groupBy: z.enum(TotalsGroupBy),
  // Subcategories of this category (CATEGORY only).
  parentId: z.string().min(1).optional(),
  // Required by CATEGORY and TAG; PERIOD returns both types.
  type: TransactionTypeSchema.optional(),
}).refine((value) => value.groupBy === TotalsGroupBy.PERIOD || value.type !== undefined, {
  message: 'type is required for CATEGORY and TAG',
});

export type GetFinanceTotalsInput = z.input<typeof GetFinanceTotalsSchema>;
