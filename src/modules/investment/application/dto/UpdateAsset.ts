import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  AssetClassSchema,
  AssetStatusSchema,
  CurrencySchema,
  IdSchema,
  NameSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  TickerSchema,
} from '@investment/application/dto/InvestmentCommon';

const EDITABLE_FIELDS = [
  'assetClass',
  'currency',
  'name',
  'owner',
  'ownerId',
  'status',
  'ticker',
] as const;

export const UpdateAssetSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    assetClass: AssetClassSchema.optional(),
    currency: CurrencySchema.optional(),
    id: IdSchema,
    name: NameSchema.optional(),
    owner: OwnerTypeSchema.optional(),
    ownerId: OwnerIdSchema.optional(),
    status: AssetStatusSchema.optional(),
    ticker: TickerSchema.nullable().optional(),
  })
  .refine((input) => EDITABLE_FIELDS.some((field) => input[field] !== undefined), {
    message: 'At least one field is required',
  })
  .refine((input) => (input.owner === undefined) === (input.ownerId === undefined), {
    message: 'owner and ownerId must be sent together',
  });

export type UpdateAssetInput = z.input<typeof UpdateAssetSchema>;
