import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  CurrencySchema,
} from '@finance/application/dto/FinanceCommon';
import { TransactionSource } from '@finance/domain/enum';

// Spec 046 §7: the parameters every dashboard endpoint shares (period, scope, currency and the 045 filters).
export const DashboardCommonSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  currency: CurrencySchema,
  filter: z
    .object({
      accountIds: z.array(z.string().min(1)).optional(),
      categoryIds: z.array(z.string().min(1)).optional(),
      creditCardIds: z.array(z.string().min(1)).optional(),
      paid: z.boolean().optional(),
      q: z.string().trim().min(1).max(100).optional(),
      source: z.enum(TransactionSource).optional(),
      tagIds: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  from: CalendarDateSchema,
  ownerIds: z.array(z.string()).optional(),
  to: CalendarDateSchema,
  today: CalendarDateSchema,
});

export const GetDashboardRowsSchema = DashboardCommonSchema.extend({ byTag: z.boolean() });

export type DashboardCommonInput = z.input<typeof DashboardCommonSchema>;
export type GetDashboardRowsInput = z.input<typeof GetDashboardRowsSchema>;
