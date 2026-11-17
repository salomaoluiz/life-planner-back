import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  IncomeSeriesEndReason,
  IncomeSeriesUnit,
  InvestmentIncomeType,
} from '@investment/domain/enum';

const DecimalApiSchema = z.string().regex(/^\d+(\.\d{1,8})?$/);
const CalendarDateApiSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IncomeTypeApiSchema = z.enum(InvestmentIncomeType);
const FrequencyApiSchema = z.strictObject({
  interval: z.number().int(),
  unit: z.enum(IncomeSeriesUnit),
});

// Spec 115 section 7: with finance the account and the category are required; without it they must be absent.
const seriesFields = {
  accountId: z.uuid().optional(),
  amountPerUnit: DecimalApiSchema,
  assetId: z.uuid(),
  categoryId: z.uuid().optional(),
  endDate: CalendarDateApiSchema.nullish(),
  exDateOffsetDays: z.number().int().min(0).max(90).nullish(),
  firstPaymentDate: CalendarDateApiSchema,
  frequency: FrequencyApiSchema,
  markPastAsReceived: z.boolean().optional(),
  notes: z.string().nullish(),
  type: IncomeTypeApiSchema,
  withFinance: z.boolean().optional(),
};

function financeRule(data: { accountId?: string; categoryId?: string; withFinance?: boolean }) {
  return data.withFinance === false
    ? !data.accountId && !data.categoryId
    : Boolean(data.accountId && data.categoryId);
}
const FINANCE_MESSAGE =
  'accountId and categoryId are required with withFinance and forbidden without';

export const CreateIncomeSeriesApiSchema = z
  .strictObject(seriesFields)
  .refine(financeRule, { message: FINANCE_MESSAGE });
export const PreviewIncomeSeriesApiSchema = CreateIncomeSeriesApiSchema;
export const UpdateIncomeSeriesApiSchema = z.strictObject({
  accountId: z.uuid().optional(),
  amountPerUnit: DecimalApiSchema.optional(),
  categoryId: z.uuid().optional(),
  endDate: CalendarDateApiSchema.nullish(),
  notes: z.string().nullish(),
  withFinance: z.boolean().optional(),
});
export const ListIncomeSeriesQuerySchema = z.object({ assetId: z.uuid() });
export const ProjectionsQuerySchema = z.object({
  from: CalendarDateApiSchema,
  owner: z.enum(['ALL', 'FAMILY', 'USER']).optional(),
  ownerId: z.uuid().optional(),
  to: CalendarDateApiSchema,
});

export const IncomeSeriesApiSchema = z.strictObject({
  accountId: z.uuid().optional(),
  amountPerUnit: z.string(),
  assetId: z.uuid(),
  categoryId: z.uuid().optional(),
  currency: z.string(),
  endDate: z.string().optional(),
  endedAt: z.string().optional(),
  endReason: z.enum(IncomeSeriesEndReason).optional(),
  exDateOffsetDays: z.number().int().optional(),
  firstPaymentDate: z.string(),
  frequency: FrequencyApiSchema,
  id: z.uuid(),
  lastGeneratedNumber: z.number().int(),
  nextPaymentDate: z.string().optional(),
  notes: z.string().optional(),
  type: IncomeTypeApiSchema,
  withFinance: z.boolean(),
});
export const IncomeSeriesItemApiSchema = z.strictObject({ item: IncomeSeriesApiSchema });
export const IncomeSeriesCreatedApiSchema = z.strictObject({
  created: z.strictObject({ planned: z.number().int(), received: z.number().int() }),
  item: IncomeSeriesApiSchema,
});
export const IncomeSeriesListApiSchema = z.strictObject({ items: z.array(IncomeSeriesApiSchema) });
export const IncomeSeriesPreviewApiSchema = z.strictObject({
  endsByPosition: z.string().nullable(),
  firstNetAmount: z.number().int().nullable(),
  firstQuantity: z.string().nullable(),
  next: z.array(z.string()),
  occurrences: z.strictObject({
    currentMonth: z.number().int(),
    max: z.number().int(),
    past: z.number().int(),
  }),
});
export const ProjectedIncomeApiSchema = z.strictObject({
  accountId: z.uuid().optional(),
  assetId: z.uuid(),
  assetLabel: z.string(),
  categoryId: z.uuid().optional(),
  currency: z.string(),
  exDate: z.string(),
  netAmount: z.number().int(),
  number: z.number().int(),
  paymentDate: z.string(),
  quantity: z.string(),
  seriesId: z.uuid(),
  type: IncomeTypeApiSchema,
  withFinance: z.boolean(),
});
export const ProjectedIncomeListApiSchema = z.strictObject({
  items: z.array(ProjectedIncomeApiSchema),
});

export type CreateIncomeSeriesApiInput = z.infer<typeof CreateIncomeSeriesApiSchema>;
export type IncomeSeriesOutputType = z.infer<typeof IncomeSeriesApiSchema>;
export type ProjectionsQuery = z.infer<typeof ProjectionsQuerySchema>;
export type UpdateIncomeSeriesApiInput = z.infer<typeof UpdateIncomeSeriesApiSchema>;

export class CreateIncomeSeriesBody extends createZodDto(CreateIncomeSeriesApiSchema) {}
export class IncomeSeriesCreatedOutput extends createZodDto(IncomeSeriesCreatedApiSchema) {}
export class IncomeSeriesItemOutput extends createZodDto(IncomeSeriesItemApiSchema) {}
export class IncomeSeriesListOutput extends createZodDto(IncomeSeriesListApiSchema) {}
export class IncomeSeriesPreviewOutput extends createZodDto(IncomeSeriesPreviewApiSchema) {}
export class PreviewIncomeSeriesBody extends createZodDto(PreviewIncomeSeriesApiSchema) {}
export class ProjectedIncomeListOutput extends createZodDto(ProjectedIncomeListApiSchema) {}
export class UpdateIncomeSeriesBody extends createZodDto(UpdateIncomeSeriesApiSchema) {}
