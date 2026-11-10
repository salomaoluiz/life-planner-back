import { z } from 'zod';

import { AccessibleOwnersSchema, IdSchema } from '@investment/application/dto/InvestmentCommon';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

export const RefreshTrackedSchema = z.object({
  closeRun: z.boolean().default(false),
  target: z.enum(['B3', 'FX', 'US']),
});
export type RefreshTrackedInput = z.input<typeof RefreshTrackedSchema>;

export const RefreshNowSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetIds: z.array(IdSchema).max(200).optional(),
  userId: z.string().min(1),
});
export type RefreshNowInput = z.input<typeof RefreshNowSchema>;

export const SearchTickersSchema = z.object({
  market: z.enum(QuoteMarket),
  q: z.string().trim().min(2).max(20),
});
export type SearchTickersInput = z.input<typeof SearchTickersSchema>;

export const PriceHistorySchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
  range: z.enum(['1M', '1Y', '6M', 'ALL']).default('1Y'),
});
export type PriceHistoryInput = z.input<typeof PriceHistorySchema>;
