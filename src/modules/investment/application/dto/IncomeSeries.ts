import { z } from 'zod';

import { IncomeTypeSchema } from '@investment/application/dto/Income';
import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  IdSchema,
  OwnerIdSchema,
  PositiveDecimalSchema,
} from '@investment/application/dto/InvestmentCommon';
import { IncomeSeriesUnit } from '@investment/domain/enum';
import { EX_DATE_OFFSET_MAX } from '@investment/domain/service/IncomeSeriesSchedule';

export const FrequencySchema = z.object({
  interval: z.number().int(),
  unit: z.enum(IncomeSeriesUnit),
});

// Spec 115 FR 8: the series fields. The frequency range is a 422 checked by the use case (spec 114 message).
const seriesFields = {
  accessibleOwners: AccessibleOwnersSchema,
  accountId: IdSchema.optional(),
  amountPerUnit: PositiveDecimalSchema,
  assetId: IdSchema,
  categoryId: IdSchema.optional(),
  endDate: CalendarDateSchema.nullish(),
  exDateOffsetDays: z.number().int().min(0).max(EX_DATE_OFFSET_MAX).nullish(),
  firstPaymentDate: CalendarDateSchema,
  frequency: FrequencySchema,
  markPastAsReceived: z.boolean().default(true),
  notes: z.string().nullish(),
  type: IncomeTypeSchema,
  withFinance: z.boolean().default(true),
};

function endDateIssue(data: { endDate?: null | string; firstPaymentDate: string }): boolean {
  return !data.endDate || data.endDate >= data.firstPaymentDate;
}
function seriesFinanceIssue(data: {
  accountId?: string;
  categoryId?: string;
  withFinance: boolean;
}): boolean {
  return data.withFinance
    ? Boolean(data.accountId && data.categoryId)
    : data.accountId === undefined && data.categoryId === undefined;
}
const FINANCE_MESSAGE =
  'accountId and categoryId are required with withFinance and forbidden without';
const END_DATE_MESSAGE = 'endDate must not be before firstPaymentDate';

export const CreateIncomeSeriesSchema = z
  .object({ ...seriesFields, userId: IdSchema })
  .refine(seriesFinanceIssue, { message: FINANCE_MESSAGE })
  .refine(endDateIssue, { message: END_DATE_MESSAGE });
export type CreateIncomeSeriesInput = z.input<typeof CreateIncomeSeriesSchema>;

export const PreviewIncomeSeriesSchema = z
  .object(seriesFields)
  .refine(seriesFinanceIssue, { message: FINANCE_MESSAGE })
  .refine(endDateIssue, { message: END_DATE_MESSAGE });
export type PreviewIncomeSeriesInput = z.input<typeof PreviewIncomeSeriesSchema>;

export const UpdateIncomeSeriesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  accountId: IdSchema.optional(),
  amountPerUnit: PositiveDecimalSchema.optional(),
  categoryId: IdSchema.optional(),
  endDate: CalendarDateSchema.nullish(),
  id: IdSchema,
  notes: z.string().nullish(),
  userId: IdSchema,
  withFinance: z.boolean().optional(),
});
export type UpdateIncomeSeriesInput = z.input<typeof UpdateIncomeSeriesSchema>;

export const GetIncomeSeriesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema,
});
export type GetIncomeSeriesInput = z.input<typeof GetIncomeSeriesSchema>;

export const GetIncomeSeriesByIdSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
});
export type GetIncomeSeriesByIdInput = z.input<typeof GetIncomeSeriesByIdSchema>;

export const MaterializeIncomeSeriesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerIds: z.array(OwnerIdSchema).optional(),
  today: CalendarDateSchema,
});
export type MaterializeIncomeSeriesInput = z.input<typeof MaterializeIncomeSeriesSchema>;

export const GetIncomeSeriesProjectionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  from: CalendarDateSchema,
  ownerIds: z.array(OwnerIdSchema).optional(),
  to: CalendarDateSchema,
  today: CalendarDateSchema.optional(),
});
export type GetIncomeSeriesProjectionsInput = z.input<typeof GetIncomeSeriesProjectionsSchema>;

export const SeriesScopeSchema = z.enum(['ALL', 'ONLY_THIS', 'THIS_AND_NEXT']);
export type SeriesScope = z.infer<typeof SeriesScopeSchema>;
