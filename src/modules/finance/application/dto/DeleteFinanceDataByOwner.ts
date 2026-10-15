import { z } from 'zod';

import { OwnerIdSchema, OwnerTypeSchema } from '@finance/application/dto/FinanceCommon';

export const DeleteFinanceDataByOwnerSchema = z.object({
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
});

export type DeleteFinanceDataByOwnerInput = z.input<typeof DeleteFinanceDataByOwnerSchema>;
