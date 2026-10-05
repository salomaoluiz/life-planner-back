import { z } from 'zod';

import { OwnerIdSchema, OwnerTypeSchema } from '@finance/application/dto/FinanceCommon';

export const HasFinanceDataByOwnerSchema = z.object({
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
});

export type HasFinanceDataByOwnerInput = z.input<typeof HasFinanceDataByOwnerSchema>;
