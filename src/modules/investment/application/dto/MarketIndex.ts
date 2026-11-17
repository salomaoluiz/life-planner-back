import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
} from '@investment/application/dto/InvestmentCommon';
import { MarketIndex } from '@investment/domain/enum';

const MAX_YEARS = 30;

export const GetMarketIndexesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  today: CalendarDateSchema,
});
export type GetMarketIndexesInput = z.input<typeof GetMarketIndexesSchema>;

// Spec 113 FR 19: the period is required, in order and at most 30 years.
export const MarketIndexHistorySchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    from: CalendarDateSchema,
    index: z.enum(MarketIndex),
    to: CalendarDateSchema,
    today: CalendarDateSchema,
  })
  .superRefine((value, ctx) => {
    const limit = `${Number(value.from.slice(0, 4)) + MAX_YEARS}${value.from.slice(4)}`;

    if (value.from > value.to) {
      ctx.addIssue({ code: 'custom', message: 'The period is inverted', path: ['from'] });
    }
    if (value.to > limit) {
      ctx.addIssue({ code: 'custom', message: 'The period is over 30 years', path: ['to'] });
    }
  });
export type MarketIndexHistoryInput = z.input<typeof MarketIndexHistorySchema>;

export const RefreshMarketIndexesNowSchema = z.object({ userId: z.string().min(1) });
export type RefreshMarketIndexesNowInput = z.input<typeof RefreshMarketIndexesNowSchema>;
