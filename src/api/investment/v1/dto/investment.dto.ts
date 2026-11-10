import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentFeeKind,
  InvestmentOperationType,
  InvestmentValuationSource,
} from '@investment/domain/enum';
import { SUPPORTED_CURRENCIES } from '@investment/domain/enum/Currency';
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
  type: z.enum(InvestmentOperationType),
  unitPrice: DecimalApiSchema,
});

// The asset and the type cannot change (FR 18): `.strict()` rejects them.
export const UpdateOperationApiSchema = z
  .strictObject({
    accountId: z.uuid().nullable(),
    date: CalendarDateApiSchema,
    fees: z.array(FeeApiSchema).max(10),
    fxRate: FxRateApiSchema.nullable(),
    generateTransaction: z.boolean(),
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

export const AssetItemApiSchema = z.strictObject({
  archivedAt: z.iso.datetime().nullable(),
  assetClass: z.enum(InvestmentAssetClass),
  currency: z.string(),
  id: z.uuid(),
  name: z.string(),
  operationCount: z.number().int(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  position: PositionApiSchema,
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
  quantity: z.string(),
  realizedResult: z.number().int().nullable(),
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

export type AssetItemOutputType = z.infer<typeof AssetItemApiSchema>;
export type CreateAssetApiInput = z.infer<typeof CreateAssetApiSchema>;
export type CreateOperationApiInput = z.infer<typeof CreateOperationApiSchema>;
export type OperationOutputType = z.infer<typeof OperationApiSchema>;
export type PositionOutputType = z.infer<typeof PositionApiSchema>;
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
export class UpdateAssetBody extends createZodDto(UpdateAssetApiSchema) {}
export class UpdateOperationBody extends createZodDto(UpdateOperationApiSchema) {}
export class UpsertValuationBody extends createZodDto(UpsertValuationApiSchema) {}
export class ValuationWriteOutput extends createZodDto(ValuationWriteApiSchema) {}
