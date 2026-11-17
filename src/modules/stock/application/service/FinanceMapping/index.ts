import { UnprocessableEntityException } from '@nestjs/common';

export interface FinanceCategoryRef {
  archived: boolean;
  id: string;
  isExpense: boolean;
}

// Spec 116 FR 22: the mapping must be a finance category the owner can use (the API passes those it can see), of type
// EXPENSE and not archived.
export function assertFinanceMapping(
  financeCategoryId: null | string | undefined,
  usable: FinanceCategoryRef[] | undefined,
): void {
  if (!financeCategoryId) {
    return;
  }

  const found = usable?.find((category) => category.id === financeCategoryId);

  if (!found || !found.isExpense || found.archived) {
    throw new UnprocessableEntityException('Finance category must be an active expense category');
  }
}
