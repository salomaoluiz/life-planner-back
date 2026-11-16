import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PositionApiSchema } from '@api/investment/v1/dto/investment.dto';

const DecimalApiSchema = z.string().regex(/^\d+(\.\d{1,8})?$/);
const CalendarDateApiSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Spec 112: the destination is an existing asset or a new one created in the same transaction.
const DestinationApiSchema = z.union([
  z.strictObject({ assetId: z.uuid() }),
  z.strictObject({
    newAsset: z.strictObject({ name: z.string().trim().min(1).max(100), ticker: z.string() }),
  }),
]);
const CashApiFields = {
  accountId: z.uuid().nullish(),
  cashAmount: z.number().int().positive().nullish(),
  cashReferenceUnitValue: DecimalApiSchema.nullish(),
  generateTransaction: z.boolean().optional(),
};

export const CreateConversionApiSchema = z.strictObject({
  date: CalendarDateApiSchema,
  destination: DestinationApiSchema,
  ratioFrom: DecimalApiSchema,
  ratioTo: DecimalApiSchema,
  ...CashApiFields,
});
// The destination can't change: a body with it is rejected as an unknown key (400).
export const UpdateConversionApiSchema = z.strictObject({
  date: CalendarDateApiSchema.optional(),
  ratioFrom: DecimalApiSchema.optional(),
  ratioTo: DecimalApiSchema.optional(),
  ...CashApiFields,
});

export const ConversionItemApiSchema = z.strictObject({
  cashAmount: z.number().int().optional(),
  cashReferenceUnitValue: z.string().optional(),
  date: z.string(),
  from: z.strictObject({
    assetId: z.uuid(),
    cost: z.number().int(),
    operationId: z.uuid(),
    quantity: z.string(),
    ticker: z.string().optional(),
  }),
  id: z.uuid(),
  locked: z.boolean(),
  ratioFrom: z.string(),
  ratioTo: z.string(),
  to: z.strictObject({
    assetId: z.uuid(),
    cost: z.number().int(),
    fractionCost: z.number().int(),
    fractionQuantity: z.string(),
    operationId: z.uuid(),
    quantity: z.string(),
    ticker: z.string().optional(),
  }),
});
export const ConversionApiSchema = z.strictObject({ item: ConversionItemApiSchema });
export const ConversionWriteApiSchema = z.strictObject({
  fromPosition: PositionApiSchema,
  item: ConversionItemApiSchema,
  toPosition: PositionApiSchema,
});

export type ConversionOutputType = z.infer<typeof ConversionApiSchema>;
export type ConversionWriteOutputType = z.infer<typeof ConversionWriteApiSchema>;
export type CreateConversionApiInput = z.infer<typeof CreateConversionApiSchema>;
export type UpdateConversionApiInput = z.infer<typeof UpdateConversionApiSchema>;

export class ConversionOutput extends createZodDto(ConversionApiSchema) {}
export class ConversionWriteOutput extends createZodDto(ConversionWriteApiSchema) {}
export class CreateConversionBody extends createZodDto(CreateConversionApiSchema) {}
export class UpdateConversionBody extends createZodDto(UpdateConversionApiSchema) {}
