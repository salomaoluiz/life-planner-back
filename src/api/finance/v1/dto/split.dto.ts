import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CalendarDateApiSchema,
  CurrencyApiSchema,
  DescriptionApiSchema,
  NotesApiSchema,
  TagNamesApiSchema,
  TransactionTypeApiSchema,
} from '@api/finance/v1/dto/finance-fields';
import {
  TransactionItemApiSchema,
  TransactionLookupsApiSchema,
} from '@api/finance/v1/dto/transaction.dto';
import { INT4_MAX, INT4_MIN, InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { SystemCategoryKey } from '@finance/domain/enum';

// Spec 119 section 7: a part names its category by id, or by `systemKey: SPLIT_ADJUSTMENT`.
export const SplitPartApiSchema = z
  .strictObject({
    categoryId: z.uuid().optional(),
    description: DescriptionApiSchema.nullish(),
    id: z.uuid().optional(),
    systemKey: z.literal(SystemCategoryKey.SPLIT_ADJUSTMENT).optional(),
    tags: TagNamesApiSchema.optional(),
    type: TransactionTypeApiSchema,
    value: z.number().int().min(INT4_MIN).max(INT4_MAX),
  })
  .refine((part) => (part.categoryId === undefined) !== (part.systemKey === undefined), {
    message: 'Send either categoryId or systemKey',
  });

const SplitSharedApiShape = {
  accountId: z.uuid().optional(),
  creditCardId: z.uuid().optional(),
  date: CalendarDateApiSchema,
  description: DescriptionApiSchema,
  invoiceMonth: InvoiceMonthSchema.optional(),
  notes: NotesApiSchema.optional(),
  paid: z.boolean().optional(),
  parts: z.array(SplitPartApiSchema),
  total: z.number().int().min(1).max(INT4_MAX).optional(),
};

export const CreateSplitApiSchema = z.strictObject({
  ...SplitSharedApiShape,
  currency: CurrencyApiSchema.optional(),
  fromTransactionId: z.uuid().nullish(),
});

// The full replacement, or only `{ paid }` (FR 19).
export const UpdateSplitApiSchema = z
  .strictObject({
    ...SplitSharedApiShape,
    date: SplitSharedApiShape.date.optional(),
    description: SplitSharedApiShape.description.optional(),
    parts: SplitSharedApiShape.parts.optional(),
  })
  .refine((input) => input.parts !== undefined || input.paid !== undefined, {
    message: 'Send the parts or paid',
  });

export const SplitApiSchema = z.strictObject({
  accountId: z.uuid().optional(),
  creditCardId: z.uuid().optional(),
  currency: CurrencyApiSchema,
  date: z.string(),
  description: z.string(),
  id: z.uuid(),
  invoiceMonth: z.string().optional(),
  notes: z.string().optional(),
  occurrenceNumber: z.number().int().optional(),
  owner: TransactionItemApiSchema.shape.owner,
  ownerId: z.uuid(),
  paid: z.boolean().optional(),
  parts: z.array(TransactionItemApiSchema),
  recurrenceId: z.uuid().optional(),
  stockPurchaseId: z.uuid().optional(),
  // Magnitude of the net of the parts and its direction (FR 13).
  total: z.number().int(),
  type: TransactionTypeApiSchema,
});

export const SplitWithLookupsApiSchema = z.strictObject({
  item: SplitApiSchema,
  lookups: TransactionLookupsApiSchema,
});

// FR 22: one part left → `dissolved: true` and the ordinary transaction that remains as `item`.
export const SplitUpdateResultApiSchema = z.strictObject({
  dissolved: z.literal(true).optional(),
  item: z.union([SplitApiSchema, TransactionItemApiSchema]),
  lookups: TransactionLookupsApiSchema,
});

export type CreateSplitApiInput = z.infer<typeof CreateSplitApiSchema>;
export type SplitItem = z.infer<typeof SplitApiSchema>;
export type SplitUpdateResult = z.infer<typeof SplitUpdateResultApiSchema>;
export type SplitWithLookups = z.infer<typeof SplitWithLookupsApiSchema>;
export type UpdateSplitApiInput = z.infer<typeof UpdateSplitApiSchema>;

export class CreateSplitBody extends createZodDto(CreateSplitApiSchema) {}
export class SplitUpdateResultOutput extends createZodDto(SplitUpdateResultApiSchema) {}
export class SplitWithLookupsOutput extends createZodDto(SplitWithLookupsApiSchema) {}
export class UpdateSplitBody extends createZodDto(UpdateSplitApiSchema) {}
