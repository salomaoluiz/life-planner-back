import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  CalendarDateSchema,
  IdSchema,
  OwnerIdSchema,
  PositiveDecimalSchema,
  QuantitySchema,
} from '@investment/application/dto/InvestmentCommon';
import { InvestmentIncomeType } from '@investment/domain/enum';

export const IncomeTypeSchema = z.enum(InvestmentIncomeType);
export const IncomeStatusSchema = z.enum(['PLANNED', 'RECEIVED']);
export type IncomeStatus = z.infer<typeof IncomeStatusSchema>;

// Spec 107 FR 3-4, 11: the fields the owner types, shared by create, edit and approve-with-edit.
const fields = {
  accountId: IdSchema,
  amountPerUnit: PositiveDecimalSchema.nullish(),
  categoryId: IdSchema,
  exDate: CalendarDateSchema.nullish(),
  netAmount: z.number().int().positive(),
  notes: z.string().nullish(),
  paymentDate: CalendarDateSchema,
  quantity: QuantitySchema.nullish(),
  status: IncomeStatusSchema,
  type: IncomeTypeSchema,
};

export const CreateIncomeSchema = z.object({
  ...fields,
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema,
  userId: IdSchema,
});
export type CreateIncomeInput = z.input<typeof CreateIncomeSchema>;

export const UpdateIncomeSchema = z.object({
  ...z.object(fields).partial().shape,
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
  userId: IdSchema,
});
export type UpdateIncomeInput = z.input<typeof UpdateIncomeSchema>;

export const ReceiveIncomeSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  accountId: IdSchema.optional(),
  id: IdSchema,
  netAmount: z.number().int().positive().optional(),
  receivedOn: CalendarDateSchema.optional(),
  userId: IdSchema,
});
export type ReceiveIncomeInput = z.input<typeof ReceiveIncomeSchema>;

export const IncomeAccessSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
});
export type IncomeAccessInput = z.input<typeof IncomeAccessSchema>;

export const GetIncomeDefaultsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema,
  exDate: CalendarDateSchema.optional(),
  type: IncomeTypeSchema.optional(),
});
export type GetIncomeDefaultsInput = z.input<typeof GetIncomeDefaultsSchema>;

export const GetIncomesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema.optional(),
  cursor: z.string().min(1).optional(),
  from: CalendarDateSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  owner: z.enum(['ALL', 'FAMILY', 'USER']).optional(),
  ownerId: OwnerIdSchema.optional(),
  status: IncomeStatusSchema.optional(),
  to: CalendarDateSchema.optional(),
  type: IncomeTypeSchema.optional(),
});
export type GetIncomesInput = z.input<typeof GetIncomesSchema>;

export const GetIncomeSuggestionsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  assetId: IdSchema.optional(),
  owner: z.enum(['ALL', 'FAMILY', 'USER']).optional(),
  ownerId: OwnerIdSchema.optional(),
});
export type GetIncomeSuggestionsInput = z.input<typeof GetIncomeSuggestionsSchema>;

// Approving with an empty body takes the suggestion as it is; any field overrides it (the edit path).
export const ApproveSuggestionSchema = z.object({
  ...z.object(fields).partial().shape,
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
  userId: IdSchema,
});
export type ApproveSuggestionInput = z.input<typeof ApproveSuggestionSchema>;

export const DecideSuggestionSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
  userId: IdSchema,
});
export type DecideSuggestionInput = z.input<typeof DecideSuggestionSchema>;

export const TransactionLinkSchema = z.object({ transactionId: IdSchema });
export type TransactionLinkInput = z.input<typeof TransactionLinkSchema>;
