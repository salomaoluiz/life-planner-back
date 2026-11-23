import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { StockListItemApiSchema } from '@api/stock/v1/dto/stock.dto';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export const BarcodeParamSchema = z.object({ code: z.string().min(1).max(80) });
export const BarcodeQuerySchema = z.object({ today: z.iso.date().optional() });

export const BarcodeLookupApiSchema = z.object({
  code: z.string(),
  matches: z.array(
    z.object({
      item: StockListItemApiSchema,
      owner: z.enum(OwnerType),
      ownerId: z.string(),
      ownerName: z.string(),
      readOnly: z.boolean(),
    }),
  ),
});

const SourceSchema = z.enum(['AI', 'OPEN_FOOD_FACTS']);
const UsageCounterSchema = z.object({ limit: z.number().int(), used: z.number().int() });

export const AiUsageApiSchema = z.object({ light: UsageCounterSchema, search: UsageCounterSchema });

export const SuggestionBodySchema = z
  .object({
    barcode: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(3).max(100).optional(),
    owner: z.enum(OwnerType),
    ownerId: z.string().min(1),
  })
  .refine((body) => (body.barcode === undefined) !== (body.name === undefined), {
    message: 'Send exactly one of barcode or name',
  });

const SuggestionFieldsSchema = z.object({
  brand: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  locationId: z.string().optional(),
  openedShelfLifeDays: z.number().int().optional(),
  packageQuantity: z.number().optional(),
  unit: z.enum(['kilogram', 'liter', 'unit']).optional(),
});

export const SuggestionApiSchema = z.object({
  fields: SuggestionFieldsSchema,
  notice: z.enum(['AI_NOT_SURE', 'AI_UNAVAILABLE', 'LIMIT_REACHED', 'NOT_FOUND']).nullable(),
  sources: z.partialRecord(
    z.enum(Object.keys(SuggestionFieldsSchema.shape) as [string, ...string[]]),
    SourceSchema,
  ),
  usage: AiUsageApiSchema,
});

export class AiUsageOutput extends createZodDto(AiUsageApiSchema) {}
export class BarcodeLookupOutput extends createZodDto(BarcodeLookupApiSchema) {}
export class SuggestionBody extends createZodDto(SuggestionBodySchema) {}
export class SuggestionOutput extends createZodDto(SuggestionApiSchema) {}
