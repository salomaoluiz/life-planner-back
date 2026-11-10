import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  AssetDetailApiSchema,
  FixedIncomeAdjustmentApiSchema,
  OperationApiSchema,
} from '@api/investment/v1/dto/investment.dto';
import {
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
  InvestmentFixedIncomeRedemptionKind,
} from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const CalendarDateApiSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Percentages travel as decimal strings with up to 4 places (spec 105 FR 7).
const PercentApiSchema = z.string().regex(/^\d+(\.\d{1,4})?$/);
const CentsApiSchema = z.number().int().positive();

function rateVariants<T extends z.ZodRawShape>(extra: T) {
  return z.discriminatedUnion('mode', [
    z.strictObject({
      ...extra,
      annualRate: PercentApiSchema,
      mode: z.literal(InvestmentFixedIncomeRateMode.PREFIXED),
    }),
    z.strictObject({
      ...extra,
      cdiPercent: PercentApiSchema,
      indexRate: PercentApiSchema,
      mode: z.literal(InvestmentFixedIncomeRateMode.CDI_PERCENT),
    }),
    z.strictObject({
      ...extra,
      indexRate: PercentApiSchema,
      mode: z.literal(InvestmentFixedIncomeRateMode.IPCA_PLUS),
      spread: PercentApiSchema,
    }),
  ]);
}

export const FirstRateApiSchema = rateVariants({});
export const RateApiSchema = rateVariants({ startDate: CalendarDateApiSchema });

const TermsFields = {
  liquidity: z.enum(InvestmentFixedIncomeLiquidity),
  liquidityDate: CalendarDateApiSchema.nullish(),
  maturityDate: CalendarDateApiSchema,
  product: z.enum(InvestmentFixedIncomeProduct),
  taxExempt: z.boolean(),
};
const TermsApiSchema = z.strictObject(TermsFields);

export const CreateFixedIncomeTitleApiSchema = z.strictObject({
  contribution: z.strictObject({
    accountId: z.uuid().nullish(),
    amount: CentsApiSchema,
    date: CalendarDateApiSchema,
    generateTransaction: z.boolean().optional(),
  }),
  name: z.string(),
  owner: z.enum(OwnerType),
  ownerId: z.uuid(),
  rate: FirstRateApiSchema,
  terms: TermsApiSchema,
});
export const UpsertTermsApiSchema = z.strictObject({
  ...TermsFields,
  rate: RateApiSchema.optional(),
});
export const ContributionApiSchema = z.strictObject({
  accountId: z.uuid().nullish(),
  amount: CentsApiSchema,
  date: CalendarDateApiSchema,
  generateTransaction: z.boolean().optional(),
});
export const RedemptionApiSchema = z.strictObject({
  accountId: z.uuid().nullish(),
  date: CalendarDateApiSchema,
  generateTransaction: z.boolean().optional(),
  kind: z.enum(InvestmentFixedIncomeRedemptionKind),
  netAmount: CentsApiSchema,
});
export const AdjustmentApiSchema = z.strictObject({ grossAmount: CentsApiSchema });
export const AdjustmentDateParamSchema = CalendarDateApiSchema;
export const SimulateApiSchema = z.strictObject({
  amount: CentsApiSchema,
  date: CalendarDateApiSchema,
  maturityDate: CalendarDateApiSchema,
  rate: FirstRateApiSchema,
  taxExempt: z.boolean(),
});
export const RedemptionPreviewApiSchema = z.strictObject({
  date: CalendarDateApiSchema,
  kind: z.enum(InvestmentFixedIncomeRedemptionKind),
  netAmount: CentsApiSchema,
});

const TotalsOutput = z.strictObject({
  gross: z.number().int(),
  iof: z.number().int(),
  ir: z.number().int(),
  net: z.number().int(),
});
const DetailItem = AssetDetailApiSchema.shape.item;

export const FixedIncomeWriteApiSchema = z.strictObject({
  detail: DetailItem,
  item: OperationApiSchema,
  liquidityWarning: z.enum(InvestmentFixedIncomeLiquidity).nullable(),
});
export const AdjustmentWriteApiSchema = z.strictObject({
  detail: DetailItem,
  item: FixedIncomeAdjustmentApiSchema.extend({ computedGross: z.number().int() }),
});
export const SimulateOutputApiSchema = z.strictObject({
  atMaturity: TotalsOutput,
  effectiveRate: z.string(),
});
export const RedemptionPreviewOutputApiSchema = z.strictObject({
  gross: z.number().int(),
  iof: z.number().int(),
  ir: z.number().int(),
  liquidityWarning: z.enum(InvestmentFixedIncomeLiquidity).nullable(),
  lots: z.array(
    z.strictObject({
      date: z.string(),
      gross: z.number().int(),
      operationId: z.uuid(),
      principalUsed: z.number().int(),
    }),
  ),
  net: z.number().int(),
  remaining: z.strictObject({ gross: z.number().int(), principal: z.number().int() }),
});

export type AdjustmentApiInput = z.infer<typeof AdjustmentApiSchema>;
export type ContributionApiInput = z.infer<typeof ContributionApiSchema>;
export type CreateFixedIncomeTitleApiInput = z.infer<typeof CreateFixedIncomeTitleApiSchema>;
export type RateApiInput = z.infer<typeof RateApiSchema>;
export type RedemptionApiInput = z.infer<typeof RedemptionApiSchema>;
export type RedemptionPreviewApiInput = z.infer<typeof RedemptionPreviewApiSchema>;
export type SimulateApiInput = z.infer<typeof SimulateApiSchema>;
export type UpsertTermsApiInput = z.infer<typeof UpsertTermsApiSchema>;

export class AdjustmentBody extends createZodDto(AdjustmentApiSchema) {}
export class AdjustmentWriteOutput extends createZodDto(AdjustmentWriteApiSchema) {}
export class ContributionBody extends createZodDto(ContributionApiSchema) {}
export class CreateFixedIncomeTitleBody extends createZodDto(CreateFixedIncomeTitleApiSchema) {}
export class FixedIncomeWriteOutput extends createZodDto(FixedIncomeWriteApiSchema) {}
export class RedemptionBody extends createZodDto(RedemptionApiSchema) {}
export class RedemptionPreviewBody extends createZodDto(RedemptionPreviewApiSchema) {}
export class RedemptionPreviewOutput extends createZodDto(RedemptionPreviewOutputApiSchema) {}
export class SimulateBody extends createZodDto(SimulateApiSchema) {}
export class SimulateOutput extends createZodDto(SimulateOutputApiSchema) {}
export class UpsertTermsBody extends createZodDto(UpsertTermsApiSchema) {}
