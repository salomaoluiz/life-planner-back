import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  AssetStatusSchema,
  IdSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@investment/application/dto/InvestmentCommon';
import { InvestmentAssetStatus } from '@investment/domain/enum';

// Read, delete and get-by-id share this shape: the caller's reach plus the asset id.
export const AssetAccessSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
});
export type AssetAccessInput = z.input<typeof AssetAccessSchema>;

export const GetAssetsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  ownerId: OwnerIdSchema.optional(),
  status: AssetStatusSchema.default(InvestmentAssetStatus.ACTIVE),
});
export type GetAssetsInput = z.input<typeof GetAssetsSchema>;

export const OwnerSchema = z.object({ owner: OwnerTypeSchema, ownerId: OwnerIdSchema });
export type OwnerInput = z.input<typeof OwnerSchema>;
