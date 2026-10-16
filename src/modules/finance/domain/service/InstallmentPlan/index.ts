import { addInvoiceMonths } from '@finance/domain/service/InvoiceCalculator';

export const MAX_INSTALLMENTS = 48;
export const MIN_INSTALLMENTS = 2;

export function installmentInvoiceMonths(firstMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addInvoiceMonths(firstMonth, index));
}

// A patch is structural (rows are deleted and recreated) only when it really changes the total, count, card or date.
export function isStructuralChange(
  current: { count: number; creditCardId: string; date: string; total: number },
  patch: { creditCardId?: string; date?: string; installments?: number; value?: number },
): boolean {
  return (
    (patch.value !== undefined && patch.value !== current.total) ||
    (patch.installments !== undefined && patch.installments !== current.count) ||
    (patch.creditCardId !== undefined && patch.creditCardId !== current.creditCardId) ||
    (patch.date !== undefined && patch.date !== current.date)
  );
}

// FR 18: unpaid rows follow `firstMonth + (k - 1)`, never go backwards or share a month with the previous row,
// and never land on a paid month; paid rows keep their invoice.
export function reassignInstallmentMonths(
  rows: { invoiceMonth: string; paid: boolean }[],
  firstMonth: string,
  paidMonths: ReadonlySet<string>,
): string[] {
  const result: string[] = [];

  rows.forEach((row, index) => {
    if (row.paid) {
      result.push(row.invoiceMonth);

      return;
    }

    let month = addInvoiceMonths(firstMonth, index);

    if (index > 0 && month <= result[index - 1]) {
      month = addInvoiceMonths(result[index - 1], 1);
    }
    while (paidMonths.has(month)) {
      month = addInvoiceMonths(month, 1);
    }

    result.push(month);
  });

  return result;
}
export function splitInstallments(total: number, count: number): number[] {
  if (count < MIN_INSTALLMENTS || count > MAX_INSTALLMENTS || total < count) {
    throw new RangeError('Invalid installments');
  }

  const base = Math.floor(total / count);
  const remainder = total - base * count;

  return Array.from({ length: count }, (_, index) => (index === 0 ? base + remainder : base));
}
