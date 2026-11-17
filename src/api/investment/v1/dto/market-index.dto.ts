import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { MarketIndex } from '@investment/domain/enum';

const CalendarDateApiSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Spec 113 section 7: values are decimal strings, dates calendar days, instants ISO strings.
const CdiApiSchema = z.strictObject({
  annual: z.string().nullable(),
  daily: z.string().nullable(),
  date: z.string(),
  followers: z.number().int(),
  lastChangeDate: z.string().nullable(),
  stale: z.boolean(),
});
const SelicApiSchema = z.strictObject({
  daily: z.string().nullable(),
  date: z.string(),
  followers: z.number().int(),
  lastChangeDate: z.string().nullable(),
  stale: z.boolean(),
  target: z.string().nullable(),
});
const IpcaApiSchema = z.strictObject({
  accumulated12m: z.string().nullable(),
  expected12m: z.string().nullable(),
  expectedDate: z.string().nullable(),
  followers: z.number().int(),
  month: z.string().nullable(),
  monthly: z.string().nullable(),
  stale: z.boolean(),
});
export const MarketIndexesApiSchema = z.strictObject({
  cdi: CdiApiSchema.nullable(),
  fx: z.array(z.strictObject({ pair: z.string(), quotedAt: z.string(), rate: z.string() })),
  ipca: IpcaApiSchema.nullable(),
  lastSuccessAt: z.string().nullable(),
  selic: SelicApiSchema.nullable(),
});

const StepPointApiSchema = z.strictObject({ date: z.string(), value: z.string() });
const MonthPointApiSchema = z.strictObject({
  accumulated12m: z.string().nullable(),
  month: z.string(),
  monthly: z.string(),
});
export const MarketIndexHistoryApiSchema = z.strictObject({
  changes: z.array(
    z.strictObject({ delta: z.string().nullable(), since: z.string(), value: z.string() }),
  ),
  followers: z.array(
    z.union([
      z.strictObject({ assetId: z.uuid(), name: z.string(), percent: z.string() }),
      z.strictObject({ assetId: z.uuid(), name: z.string(), spread: z.string() }),
    ]),
  ),
  index: z.enum(MarketIndex),
  points: z.array(z.union([StepPointApiSchema, MonthPointApiSchema])),
});

export const MarketIndexParamSchema = z.object({ index: z.enum(MarketIndex) });
export const MarketIndexHistoryQuerySchema = z.object({
  from: CalendarDateApiSchema,
  to: CalendarDateApiSchema,
});

export type MarketIndexesOutputType = z.infer<typeof MarketIndexesApiSchema>;
export type MarketIndexHistoryOutputType = z.infer<typeof MarketIndexHistoryApiSchema>;

export class MarketIndexesOutput extends createZodDto(MarketIndexesApiSchema) {}
export class MarketIndexHistoryOutput extends createZodDto(MarketIndexHistoryApiSchema) {}
