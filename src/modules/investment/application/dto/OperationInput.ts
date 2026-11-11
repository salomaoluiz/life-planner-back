import { z } from 'zod';

import { eventFields } from '@investment/application/dto/EventInput';
import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  FeesSchema,
  FxRateSchema,
  IdSchema,
  PositiveDecimalSchema,
  QuantitySchema,
} from '@investment/application/dto/InvestmentCommon';
import { today } from '@investment/application/service/Today';
import {
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
} from '@investment/domain/enum';

// Create takes buys and sells here; events have their own schema (spec 108).
const TradeTypeSchema = z.enum([InvestmentOperationType.BUY, InvestmentOperationType.SELL]);
const PastDateSchema = CalendarDateSchema.refine((value) => value <= today(), {
  message: 'Date cannot be in the future',
});

export const CreateOperationSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: IdSchema.nullish(),
    assetId: IdSchema,
    date: PastDateSchema,
    fees: FeesSchema.default([]),
    fxRate: FxRateSchema.nullish(),
    generateTransaction: z.boolean().default(true),
    quantity: QuantitySchema,
    type: TradeTypeSchema,
    unitPrice: PositiveDecimalSchema,
  })
  .refine((input) => input.generateTransaction === !!input.accountId, {
    message: 'accountId is required when generating a finance entry, and must be empty otherwise',
    path: ['accountId'],
  });
export type CreateOperationInput = z.input<typeof CreateOperationSchema>;

// Editing can change every field except the asset and the type (FR 18); the merged result is validated by the use case.
export const UpdateOperationSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    accountId: IdSchema.nullish(),
    // Spec 105: the fixed income shape of a contribution (`amount`) or a redemption (`kind`, `netAmount`).
    amount: z.number().int().positive().optional(),
    // Spec 108: the fields of an event (ratio or bonus) and the auction amount of a fraction sale.
    ...z.object(eventFields).partial().shape,
    bonusUnitCost: eventFields.bonusUnitCost.nullish(),
    date: PastDateSchema.optional(),
    fees: FeesSchema.optional(),
    fxRate: FxRateSchema.nullish(),
    generateTransaction: z.boolean().optional(),
    grossAmount: z.number().int().min(0).optional(),
    id: IdSchema,
    kind: z.enum(InvestmentFixedIncomeRedemptionKind).optional(),
    netAmount: z.number().int().positive().optional(),
    quantity: QuantitySchema.optional(),
    unitPrice: PositiveDecimalSchema.optional(),
  })
  .refine(
    (input) =>
      [
        'accountId',
        'amount',
        'bonusPercent',
        'bonusUnitCost',
        'date',
        'fees',
        'fxRate',
        'generateTransaction',
        'grossAmount',
        'kind',
        'netAmount',
        'quantity',
        'ratioFrom',
        'ratioTo',
        'unitPrice',
      ].some((field) => input[field as keyof typeof input] !== undefined),
    { message: 'At least one field is required' },
  );
export type UpdateOperationInput = z.input<typeof UpdateOperationSchema>;

export const OperationAccessSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
});
export type OperationAccessInput = z.input<typeof OperationAccessSchema>;

export const UpsertValuationSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema,
  date: PastDateSchema,
  unitPrice: PositiveDecimalSchema,
});
export type UpsertValuationInput = z.input<typeof UpsertValuationSchema>;

export const FindOperationByTransactionSchema = z.object({ transactionId: IdSchema });
export type FindOperationByTransactionInput = z.input<typeof FindOperationByTransactionSchema>;
