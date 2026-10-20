import { z } from 'zod';

import { CalendarDateSchema } from '@finance/application/dto/FinanceCommon';

export const GetFamilyArchiveBlockersSchema = z.object({
  familyId: z.string().min(1),
  today: CalendarDateSchema,
});

// Lists are capped; `counts` always carries the real totals.
export const BLOCKER_LIST_LIMIT = 20;

export type FamilyBlockerKind =
  | 'installmentPlans'
  | 'invoices'
  | 'recurrences'
  | 'unpaidTransactions';
export interface FamilyBlockers {
  counts: Record<FamilyBlockerKind, number>;
  installmentPlans: { description: string; id: string; remainingInstallments: number }[];
  invoices: { amountDue: number; creditCardId: string; creditCardName: string; month: string }[];
  recurrences: { description: string; id: string; nextOccurrenceDate: null | string }[];
  unpaidTransactions: { date: string; description: string; id: string; value: number }[];
}
export type GetFamilyArchiveBlockersInput = z.input<typeof GetFamilyArchiveBlockersSchema>;
