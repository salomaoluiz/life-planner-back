import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentFeeKind,
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
  InvestmentValuationSource,
} from '@investment/domain/enum';
import { SUPPORTED_CURRENCIES } from '@investment/domain/enum/Currency';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Quantities and unit prices travel as decimal strings (up to 8 places), never as numbers.
const DecimalApiSchema = z.string().regex(/^\d+(\.\d{1,8})?$/);
const CalendarDateApiSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// BRL per 1 unit of the foreign currency, a decimal string (spec 104).
const FxRateApiSchema = z.string().regex(/^\d+(\.\d{1,6})?$/);
const CurrencyApiSchema = z.enum(SUPPORTED_CURRENCIES);
const OwnerTypeApiSchema = z.enum(OwnerType);

const FeeApiSchema = z.strictObject({
  amount: z.number().int().positive(),
  description: z.string().trim().min(1).max(60).nullish(),
  kind: z.enum(InvestmentFeeKind),
});

export const CreateAssetApiSchema = z.strictObject({
  assetClass: z.enum(InvestmentAssetClass),
  currency: CurrencyApiSchema.optional(),
  currentUnitPrice: DecimalApiSchema.nullish(),
  name: z.string(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  ticker: z.string().nullish(),
});

export const UpdateAssetApiSchema = z
  .strictObject({
    assetClass: z.enum(InvestmentAssetClass),
    currency: CurrencyApiSchema,
    name: z.string(),
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
    status: z.enum(InvestmentAssetStatus),
    ticker: z.string().nullable(),
  })
  .partial();

export const CreateOperationApiSchema = z.strictObject({
  accountId: z.uuid().nullish(),
  date: CalendarDateApiSchema,
  fees: z.array(FeeApiSchema).max(10).optional(),
  fxRate: FxRateApiSchema.nullish(),
  generateTransaction: z.boolean().optional(),
  quantity: DecimalApiSchema,
  type: z.enum([InvestmentOperationType.BUY, InvestmentOperationType.SELL]),
  unitPrice: DecimalApiSchema,
});

// The asset and the type cannot change (FR 18): `.strict()` rejects them.
// Spec 105: on a calculated title the body is `{ date, amount, ... }` (contribution) or `{ date, kind, netAmount, ... }`.
export const UpdateOperationApiSchema = z
  .strictObject({
    accountId: z.uuid().nullable(),
    amount: z.number().int().positive(),
    date: CalendarDateApiSchema,
    fees: z.array(FeeApiSchema).max(10),
    fxRate: FxRateApiSchema.nullable(),
    generateTransaction: z.boolean(),
    kind: z.enum(InvestmentFixedIncomeRedemptionKind),
    netAmount: z.number().int().positive(),
    quantity: DecimalApiSchema,
    unitPrice: DecimalApiSchema,
  })
  .partial();

export const UpsertValuationApiSchema = z.strictObject({ unitPrice: DecimalApiSchema });

export const ValuationDateParamSchema = CalendarDateApiSchema;

export const PositionApiSchema = z.strictObject({
  averagePrice: z.string().nullable(),
  cost: z.number().int(),
  currentUnitPrice: z.string().nullable(),
  currentValue: z.number().int().nullable(),
  currentValueDate: z.string().nullable(),
  openResult: z.number().int().nullable(),
  openResultPercent: z.number().nullable(),
  quantity: z.string(),
  realizedResult: z.number().int(),
});

export const QuoteApiSchema = z.strictObject({
  changePercent: z.string().nullable(),
  dayHigh: z.string().nullable(),
  dayLow: z.string().nullable(),
  market: z.enum(QuoteMarket),
  previousClose: z.string().nullable(),
  price: z.string(),
  quotedAt: z.iso.datetime(),
  source: z.string(),
  stale: z.boolean(),
  ticker: z.string(),
  unavailable: z.boolean(),
});
const FxApiSchema = z.strictObject({ quotedAt: z.iso.datetime(), rate: z.string() });

const TotalsApiSchema = z.strictObject({
  gross: z.number().int(),
  iof: z.number().int(),
  ir: z.number().int(),
  net: z.number().int(),
});
const FixedIncomeLotApiSchema = z.strictObject({
  date: z.string(),
  days: z.number().int(),
  gross: z.number().int(),
  iof: z.number().int(),
  iofRate: z.string(),
  ir: z.number().int(),
  irRate: z.string(),
  net: z.number().int(),
  operationId: z.uuid(),
  principal: z.number().int(),
  remainingPrincipal: z.number().int(),
});
export const FixedIncomeRateApiSchema = z.strictObject({
  annualRate: z.string().nullable(),
  cdiPercent: z.string().nullable(),
  effectiveRate: z.string(),
  id: z.uuid(),
  indexRate: z.string().nullable(),
  mode: z.enum(InvestmentFixedIncomeRateMode),
  spread: z.string().nullable(),
  startDate: z.string(),
});
export const FixedIncomeAdjustmentApiSchema = z.strictObject({
  date: z.string(),
  grossAmount: z.number().int(),
  id: z.uuid(),
});
// Spec 105 FR 26: the list carries the summary, the detail adds the history, the lots and the projection.
const FixedIncomeListApiSchema = z.strictObject({
  currentEffectiveRate: z.string().nullable(),
  liquidity: z.enum(InvestmentFixedIncomeLiquidity),
  liquidityDate: z.string().nullable(),
  maturityDate: z.string(),
  maturityPending: z.boolean(),
  product: z.enum(InvestmentFixedIncomeProduct),
  taxExempt: z.boolean(),
  today: TotalsApiSchema,
});
const FixedIncomeDetailApiSchema = FixedIncomeListApiSchema.extend({
  adjustments: z.array(FixedIncomeAdjustmentApiSchema),
  atMaturity: TotalsApiSchema,
  lots: z.array(FixedIncomeLotApiSchema),
  rates: z.array(FixedIncomeRateApiSchema),
});

export const AssetItemApiSchema = z.strictObject({
  archivedAt: z.iso.datetime().nullable(),
  assetClass: z.enum(InvestmentAssetClass),
  averageFxRate: z.string().nullable(),
  costBrl: z.number().int().nullable(),
  currency: z.string(),
  currentPriceSource: z.enum(['MANUAL', 'QUOTE']).nullable(),
  fixedIncome: FixedIncomeListApiSchema.nullable(),
  fx: FxApiSchema.nullable(),
  id: z.uuid(),
  marketValueBrl: z.number().int().nullable(),
  name: z.string(),
  operationCount: z.number().int(),
  operationsWithoutFxRate: z.number().int(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  position: PositionApiSchema,
  quote: QuoteApiSchema.nullable(),
  resultBrl: z.number().int().nullable(),
  resultBrlFromAsset: z.number().int().nullable(),
  resultBrlFromFx: z.number().int().nullable(),
  resultBrlPercent: z.number().nullable(),
  status: z.enum(InvestmentAssetStatus),
  ticker: z.string().nullable(),
});

const OperationFeeApiSchema = z.strictObject({
  amount: z.number().int(),
  description: z.string().nullable(),
  id: z.uuid(),
  kind: z.enum(InvestmentFeeKind),
});

export const OperationApiSchema = z.strictObject({
  accountId: z.uuid().nullable(),
  costRemoved: z.number().int().nullable(),
  date: z.string(),
  fees: z.array(OperationFeeApiSchema),
  feesTotal: z.number().int(),
  fxRate: z.string().nullable(),
  generateTransaction: z.boolean(),
  gross: z.number().int(),
  id: z.uuid(),
  netAmount: z.number().int().nullable(),
  quantity: z.string(),
  realizedResult: z.number().int().nullable(),
  redemptionKind: z.enum(InvestmentFixedIncomeRedemptionKind).nullable(),
  total: z.number().int(),
  transactionId: z.uuid().nullable(),
  type: z.enum(InvestmentOperationType),
  unitPrice: z.string(),
});

export const ValuationApiSchema = z.strictObject({
  date: z.string(),
  id: z.uuid(),
  source: z.enum(InvestmentValuationSource),
  unitPrice: z.string(),
});

export const AssetListApiSchema = z.strictObject({ items: z.array(AssetItemApiSchema) });
export const AssetDetailApiSchema = z.strictObject({
  item: AssetItemApiSchema.extend({
    fixedIncome: FixedIncomeDetailApiSchema.nullable(),
    operations: z.array(OperationApiSchema),
    valuations: z.array(ValuationApiSchema),
  }),
});
export const OperationWriteApiSchema = z.strictObject({
  item: OperationApiSchema,
  position: PositionApiSchema,
});
export const ValuationWriteApiSchema = z.strictObject({
  item: ValuationApiSchema,
  position: PositionApiSchema,
});

export const ListAssetsQuerySchema = z.object({
  ownerId: z.uuid().optional(),
  status: z.enum(InvestmentAssetStatus).optional(),
});

export const TickerSearchQuerySchema = z.object({
  market: z.enum(QuoteMarket),
  q: z.string().trim().min(2).max(20),
});
export const TickerSearchApiSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      changePercent: z.string().nullable(),
      currency: z.string(),
      exchange: z.string(),
      logoUrl: z.string().nullable(),
      market: z.enum(QuoteMarket),
      name: z.string().nullable(),
      price: z.string(),
      ticker: z.string(),
    }),
  ),
});
export const RefreshQuotesApiSchema = z.strictObject({
  assetIds: z.array(z.uuid()).max(200).optional(),
});
export const RefreshQuotesOutputApiSchema = z.strictObject({
  fx: z.strictObject({ pair: z.string(), quotedAt: z.iso.datetime(), rate: z.string() }).nullable(),
  nextRefreshAt: z.iso.datetime(),
  quotes: z.array(QuoteApiSchema),
});
export const PriceHistoryQuerySchema = z.object({
  range: z.enum(['1M', '1Y', '6M', 'ALL']).default('1Y'),
});
export const PriceHistoryApiSchema = z.strictObject({
  currency: z.string(),
  historyStartsAt: z.string().nullable(),
  points: z.array(
    z.strictObject({
      date: z.string(),
      fxRate: z.string().nullable(),
      kind: z.enum(['CLOSE', 'OPERATION', 'VALUATION']),
      price: z.string(),
    }),
  ),
});

export type AssetDetailOutputType = z.infer<typeof AssetDetailApiSchema>;
export type AssetItemOutputType = z.infer<typeof AssetItemApiSchema>;
export type CreateAssetApiInput = z.infer<typeof CreateAssetApiSchema>;
export type CreateOperationApiInput = z.infer<typeof CreateOperationApiSchema>;
export type OperationOutputType = z.infer<typeof OperationApiSchema>;
export type PositionOutputType = z.infer<typeof PositionApiSchema>;
export type QuoteOutputType = z.infer<typeof QuoteApiSchema>;
export type UpdateAssetApiInput = z.infer<typeof UpdateAssetApiSchema>;
export type UpdateOperationApiInput = z.infer<typeof UpdateOperationApiSchema>;
export type UpsertValuationApiInput = z.infer<typeof UpsertValuationApiSchema>;
export type ValuationOutputType = z.infer<typeof ValuationApiSchema>;

export class AssetDetailOutput extends createZodDto(AssetDetailApiSchema) {}
export class AssetItemOutput extends createZodDto(AssetItemApiSchema) {}
export class AssetListOutput extends createZodDto(AssetListApiSchema) {}
export class CreateAssetBody extends createZodDto(CreateAssetApiSchema) {}
export class CreateOperationBody extends createZodDto(CreateOperationApiSchema) {}
export class OperationWriteOutput extends createZodDto(OperationWriteApiSchema) {}
export class PriceHistoryOutput extends createZodDto(PriceHistoryApiSchema) {}
export class RefreshQuotesBody extends createZodDto(RefreshQuotesApiSchema) {}
export class RefreshQuotesOutput extends createZodDto(RefreshQuotesOutputApiSchema) {}
export class TickerSearchOutput extends createZodDto(TickerSearchApiSchema) {}
export class UpdateAssetBody extends createZodDto(UpdateAssetApiSchema) {}
export class UpdateOperationBody extends createZodDto(UpdateOperationApiSchema) {}
export class UpsertValuationBody extends createZodDto(UpsertValuationApiSchema) {}
export class ValuationWriteOutput extends createZodDto(ValuationWriteApiSchema) {}
