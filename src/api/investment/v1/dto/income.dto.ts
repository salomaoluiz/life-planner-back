import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { InvestmentIncomeType } from '@investment/domain/enum';

const DecimalApiSchema = z.string().regex(/^\d+(\.\d{1,8})?$/);
const CalendarDateApiSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IncomeTypeApiSchema = z.enum(InvestmentIncomeType);
const IncomeStatusApiSchema = z.enum(['PLANNED', 'RECEIVED']);

// Spec 107 section 7: money in integer minor units, quantities and prices as decimal strings.
const fields = {
  accountId: z.uuid(),
  amountPerUnit: DecimalApiSchema.nullish(),
  categoryId: z.uuid(),
  exDate: CalendarDateApiSchema.nullish(),
  netAmount: z.number().int().positive(),
  notes: z.string().nullish(),
  paymentDate: CalendarDateApiSchema,
  quantity: DecimalApiSchema.nullish(),
  status: IncomeStatusApiSchema,
  type: IncomeTypeApiSchema,
};

export const CreateIncomeApiSchema = z.strictObject({ ...fields, assetId: z.uuid() });
export const UpdateIncomeApiSchema = z.strictObject(z.object(fields).partial().shape);
export const ReceiveIncomeApiSchema = z.strictObject({
  accountId: z.uuid().optional(),
  netAmount: z.number().int().positive().optional(),
  receivedOn: CalendarDateApiSchema.optional(),
});
export const ApproveSuggestionApiSchema = z.strictObject(z.object(fields).partial().shape);

export const IncomeDefaultsQuerySchema = z.object({
  exDate: CalendarDateApiSchema.optional(),
  type: IncomeTypeApiSchema.optional(),
});
export const ListIncomesQuerySchema = z.object({
  assetId: z.uuid().optional(),
  cursor: z.string().min(1).max(200).optional(),
  from: CalendarDateApiSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  owner: z.enum(['ALL', 'FAMILY', 'USER']).optional(),
  ownerId: z.uuid().optional(),
  status: IncomeStatusApiSchema.optional(),
  to: CalendarDateApiSchema.optional(),
  type: IncomeTypeApiSchema.optional(),
});
export const ListSuggestionsQuerySchema = z.object({
  assetId: z.uuid().optional(),
  owner: z.enum(['ALL', 'FAMILY', 'USER']).optional(),
  ownerId: z.uuid().optional(),
});

export const IncomeApiSchema = z.strictObject({
  accountId: z.uuid().optional(),
  amountPerUnit: z.string().optional(),
  assetId: z.uuid(),
  categoryId: z.uuid().optional(),
  currency: z.string(),
  estimatedGross: z.number().int(),
  estimatedWithheld: z.number().int(),
  exDate: z.string().optional(),
  id: z.uuid(),
  netAmount: z.number().int(),
  notes: z.string().optional(),
  overdue: z.boolean(),
  paymentDate: z.string(),
  quantity: z.string().optional(),
  status: IncomeStatusApiSchema,
  suggestionId: z.uuid().optional(),
  transactionId: z.uuid().optional(),
  type: IncomeTypeApiSchema,
  withholdingRate: z.string(),
});
export const IncomeWriteApiSchema = z.strictObject({ item: IncomeApiSchema });
export const IncomeListApiSchema = z.strictObject({
  items: z.array(IncomeApiSchema),
  nextCursor: z.string().nullable(),
  summary: z
    .strictObject({
      currency: z.string(),
      pendingSuggestions: z.number().int(),
      plannedTotal: z.number().int(),
      receivedThisYear: z.number().int(),
    })
    .optional(),
});
export const IncomeDefaultsApiSchema = z.strictObject({
  accountId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  currency: z.string(),
  quantity: z.string(),
  withholdingRate: z.string(),
});
export const IncomeSuggestionApiSchema = z.strictObject({
  amountPerUnit: z.string(),
  assetId: z.uuid(),
  canApproveDirectly: z.boolean(),
  currency: z.string(),
  estimatedGross: z.number().int(),
  estimatedNet: z.number().int(),
  exDate: z.string(),
  id: z.uuid(),
  paymentDate: z.string().optional(),
  quantity: z.string(),
  ticker: z.string(),
  type: IncomeTypeApiSchema,
  withholdingRate: z.string(),
});
export const IncomeSuggestionListApiSchema = z.strictObject({
  count: z.number().int(),
  items: z.array(IncomeSuggestionApiSchema),
});

export type ApproveSuggestionApiInput = z.infer<typeof ApproveSuggestionApiSchema>;
export type CreateIncomeApiInput = z.infer<typeof CreateIncomeApiSchema>;
export type IncomeOutputType = z.infer<typeof IncomeApiSchema>;
export type ReceiveIncomeApiInput = z.infer<typeof ReceiveIncomeApiSchema>;
export type UpdateIncomeApiInput = z.infer<typeof UpdateIncomeApiSchema>;

export class ApproveSuggestionBody extends createZodDto(ApproveSuggestionApiSchema) {}
export class CreateIncomeBody extends createZodDto(CreateIncomeApiSchema) {}
export class IncomeDefaultsOutput extends createZodDto(IncomeDefaultsApiSchema) {}
export class IncomeListOutput extends createZodDto(IncomeListApiSchema) {}
export class IncomeSuggestionListOutput extends createZodDto(IncomeSuggestionListApiSchema) {}
export class IncomeWriteOutput extends createZodDto(IncomeWriteApiSchema) {}
export class ReceiveIncomeBody extends createZodDto(ReceiveIncomeApiSchema) {}
export class UpdateIncomeBody extends createZodDto(UpdateIncomeApiSchema) {}
