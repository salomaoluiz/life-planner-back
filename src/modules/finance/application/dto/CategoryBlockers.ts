import { z } from 'zod';

import { AccessibleOwnersSchema } from '@finance/application/dto/FinanceCommon';

export const GetCategoryArchiveBlockersSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  // The category and its descendants.
  categoryIds: z.array(z.string().min(1)).min(1),
  // Every scope the category belongs to: pending items of scopes the caller cannot see are only counted.
  scopes: AccessibleOwnersSchema,
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export interface BlockerInstallmentPlan {
  categoryId: string;
  description: string;
  id: string;
  lastInvoiceMonth: string;
  remainingInstallments: number;
}
export interface BlockerRecurrence {
  categoryId: string;
  description: string;
  id: string;
  nextOccurrenceDate: null | string;
}
export interface CategoryArchiveBlockers {
  // Pending items the caller cannot see (another member's family).
  hiddenCount: number;
  installmentPlans: BlockerInstallmentPlan[];
  recurrences: BlockerRecurrence[];
}
export type GetCategoryArchiveBlockersInput = z.input<typeof GetCategoryArchiveBlockersSchema>;
