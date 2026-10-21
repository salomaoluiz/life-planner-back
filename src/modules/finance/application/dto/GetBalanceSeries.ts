import { z } from 'zod';

import { DashboardCommonSchema } from '@finance/application/dto/GetDashboardRows';

export const GetBalanceSeriesSchema = DashboardCommonSchema.extend({
  granularity: z.enum(['DAY', 'MONTH', 'WEEK']),
});

export type GetBalanceSeriesInput = z.input<typeof GetBalanceSeriesSchema>;
