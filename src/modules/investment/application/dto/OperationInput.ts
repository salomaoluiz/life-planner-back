import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  FeesSchema,
  IdSchema,
  OperationTypeSchema,
  PositiveDecimalSchema,
  QuantitySchema,
} from '@investment/application/dto/InvestmentCommon';
import { today } from '@investment/application/service/Today';

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
    generateTransaction: z.boolean().default(true),
    quantity: QuantitySchema,
    type: OperationTypeSchema,
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
    date: PastDateSchema.optional(),
    fees: FeesSchema.optional(),
    generateTransaction: z.boolean().optional(),
    id: IdSchema,
    quantity: QuantitySchema.optional(),
    unitPrice: PositiveDecimalSchema.optional(),
  })
  .refine(
    (input) =>
      ['accountId', 'date', 'fees', 'generateTransaction', 'quantity', 'unitPrice'].some(
        (field) => input[field as keyof typeof input] !== undefined,
      ),
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
