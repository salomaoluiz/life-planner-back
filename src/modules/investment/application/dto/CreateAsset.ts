import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  AssetClassSchema,
  CurrencySchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  PositiveDecimalSchema,
  TickerSchema,
} from '@investment/application/dto/InvestmentCommon';
import { TICKER_REQUIRED_CLASSES } from '@investment/domain/enum';

export const CreateAssetSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    assetClass: AssetClassSchema,
    currency: CurrencySchema.default('BRL'),
    currentUnitPrice: PositiveDecimalSchema.nullish(),
    name: NameSchema,
    owner: OwnerTypeSchema,
    ownerId: OwnerIdSchema,
    ticker: TickerSchema.nullish(),
  })
  .refine((input) => !TICKER_REQUIRED_CLASSES.includes(input.assetClass) || !!input.ticker, {
    message: 'Ticker is required for this class',
    path: ['ticker'],
  });

export type CreateAssetInput = z.input<typeof CreateAssetSchema>;
