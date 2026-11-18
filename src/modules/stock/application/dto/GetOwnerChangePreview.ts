import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
} from '@stock/application/dto/StockCommon';

export const GetOwnerChangePreviewSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: z.string().min(1),
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
});

export type GetOwnerChangePreviewInput = z.input<typeof GetOwnerChangePreviewSchema>;
