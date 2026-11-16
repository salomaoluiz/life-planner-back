import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  IdSchema,
  NameSchema,
  PositiveDecimalSchema,
  TickerSchema,
} from '@investment/application/dto/InvestmentCommon';
import { today } from '@investment/application/service/Today';
import { Decimal8 } from '@shared/infra/decimal';

const MAX_RATIO = Decimal8.parse('1000000');

const PastDateSchema = CalendarDateSchema.refine((value) => value <= today(), {
  message: 'Date cannot be in the future',
});
// Spec 112 FR 1: positive decimal strings, up to 8 places, max 1 000 000.
const RatioSchema = PositiveDecimalSchema.refine((value) => value.compare(MAX_RATIO) <= 0, {
  message: 'Ratio is too large',
});
const CashAmountSchema = z.number().int().positive();

export const DestinationSchema = z.union([
  z.object({ assetId: IdSchema }).strict(),
  z.object({ newAsset: z.object({ name: NameSchema, ticker: TickerSchema }).strict() }).strict(),
]);

// Spec 112 FR 14: the cash part needs its reference value; a finance entry needs the cash part and an account.
const cashFields = {
  accountId: IdSchema.nullish(),
  cashAmount: CashAmountSchema.nullish(),
  cashReferenceUnitValue: PositiveDecimalSchema.nullish(),
  generateTransaction: z.boolean().optional(),
};

export interface CashIssue {
  field: string;
  message: string;
}

interface CashShape {
  accountId?: null | string;
  cashAmount?: null | number;
  cashReferenceUnitValue?: Decimal8 | null;
  generateTransaction?: boolean;
}

// The problems of the cash fields (FR 14), shared by the create schema and the merged edit.
export function cashIssues(input: CashShape): CashIssue[] {
  const hasCash = input.cashAmount != null;
  const issues: CashIssue[] = [];

  if (hasCash && input.cashReferenceUnitValue == null) {
    issues.push({
      field: 'cashReferenceUnitValue',
      message: 'cashReferenceUnitValue is required with cashAmount',
    });
  }
  if (!hasCash && input.cashReferenceUnitValue != null) {
    issues.push({ field: 'cashAmount', message: 'cashReferenceUnitValue needs cashAmount' });
  }
  if (input.generateTransaction && (!hasCash || !input.accountId)) {
    issues.push({ field: 'accountId', message: 'A finance entry needs cashAmount and accountId' });
  }
  if (!input.generateTransaction && input.accountId) {
    issues.push({ field: 'accountId', message: 'accountId must be empty without a finance entry' });
  }

  return issues;
}

function checkCashFields(input: CashShape, ctx: z.RefinementCtx): void {
  for (const issue of cashIssues(input)) {
    ctx.addIssue({ code: 'custom', message: issue.message, path: [issue.field] });
  }
}

export const CreateConversionSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    assetId: IdSchema,
    date: PastDateSchema,
    destination: DestinationSchema,
    ratioFrom: RatioSchema,
    ratioTo: RatioSchema,
    ...cashFields,
  })
  .strict()
  .transform((input) => ({ ...input, generateTransaction: input.generateTransaction ?? false }))
  .superRefine(checkCashFields);
export type CreateConversionInput = z.input<typeof CreateConversionSchema>;

// Any subset; `cashAmount: null` removes the cash part. The destination can't change.
export const UpdateConversionSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    date: PastDateSchema.optional(),
    destination: z.never().optional(),
    id: IdSchema,
    ratioFrom: RatioSchema.optional(),
    ratioTo: RatioSchema.optional(),
    ...cashFields,
  })
  .strict();
export type UpdateConversionInput = z.input<typeof UpdateConversionSchema>;

export const ConversionAccessSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
});
export type ConversionAccessInput = z.input<typeof ConversionAccessSchema>;
