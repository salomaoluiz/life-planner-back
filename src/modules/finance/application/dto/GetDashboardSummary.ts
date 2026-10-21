import { z } from 'zod';

import { DashboardCommonSchema } from '@finance/application/dto/GetDashboardRows';

export const GetDashboardSummarySchema = DashboardCommonSchema;

export type GetDashboardSummaryInput = z.input<typeof GetDashboardSummarySchema>;
