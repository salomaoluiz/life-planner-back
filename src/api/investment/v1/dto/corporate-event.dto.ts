import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { InvestmentFeeKind, InvestmentOperationType } from '@investment/domain/enum';

const DecimalApiSchema = z.string().regex(/^\d+(\.\d{1,8})?$/);
const CalendarDateApiSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const EventTypeApiSchema = z.enum([
  InvestmentOperationType.SPLIT,
  InvestmentOperationType.REVERSE_SPLIT,
  InvestmentOperationType.BONUS,
]);

// Spec 108 FR 15: the cash of a fraction auction; 0 writes the fraction off (no finance entry).
export const CreateFractionSaleApiSchema = z.strictObject({
  accountId: z.uuid().nullish(),
  date: CalendarDateApiSchema,
  fees: z
    .array(
      z.strictObject({
        amount: z.number().int().positive(),
        description: z.string().trim().min(1).max(60).nullish(),
        kind: z.enum(InvestmentFeeKind),
      }),
    )
    .max(10)
    .optional(),
  generateTransaction: z.boolean().optional(),
  grossAmount: z.number().int().min(0),
});

export const EventSuggestionsQuerySchema = z.object({
  assetId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  owner: z.enum(['ALL', 'FAMILY', 'USER']).optional(),
  ownerId: z.uuid().optional(),
});

// Approving with an empty body takes the suggestion as it is; any field overrides it (the edit path).
export const ApproveEventSuggestionApiSchema = z
  .strictObject({
    bonusPercent: DecimalApiSchema,
    bonusUnitCost: DecimalApiSchema.nullable(),
    date: CalendarDateApiSchema,
    ratioFrom: DecimalApiSchema,
    ratioTo: DecimalApiSchema,
    type: EventTypeApiSchema,
  })
  .partial();

// Nulls are left out, like the finance payload (spec 079).
export const EventSuggestionApiSchema = z.strictObject({
  assetId: z.uuid(),
  averagePriceAfter: z.string().optional(),
  averagePriceBefore: z.string().optional(),
  bonusPercent: z.string().optional(),
  bonusUnitCost: z.string().optional(),
  currency: z.string(),
  date: z.string(),
  fractionQuantity: z.string(),
  id: z.uuid(),
  quantityAfter: z.string(),
  quantityBefore: z.string(),
  ratioFrom: z.string().optional(),
  ratioTo: z.string().optional(),
  ticker: z.string(),
  type: EventTypeApiSchema,
});
export const EventSuggestionListApiSchema = z.strictObject({
  count: z.number().int(),
  items: z.array(EventSuggestionApiSchema),
  nextCursor: z.uuid().nullable(),
});

export type ApproveEventSuggestionApiInput = z.infer<typeof ApproveEventSuggestionApiSchema>;
export type CreateFractionSaleApiInput = z.infer<typeof CreateFractionSaleApiSchema>;
export type EventSuggestionListOutputType = z.infer<typeof EventSuggestionListApiSchema>;

export class ApproveEventSuggestionBody extends createZodDto(ApproveEventSuggestionApiSchema) {}
export class CreateFractionSaleBody extends createZodDto(CreateFractionSaleApiSchema) {}
export class EventSuggestionListOutput extends createZodDto(EventSuggestionListApiSchema) {}
