import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';

export type ImportRowKind =
  | 'ACCOUNT_TRANSACTION'
  | 'CARD_PURCHASE'
  | 'EARLY_PAYMENT'
  | 'INVOICE_PAYMENT'
  | 'PREPAYMENT_DISCOUNT'
  | 'REFUND';
export type ImportRowKindError =
  | 'ACCOUNT_AND_CARD'
  | 'CARD_CREDIT_CATEGORY_MISUSED'
  | 'CARD_INCOME_CATEGORY';

interface KindRow {
  accountId?: null | string;
  categoryId: string;
  creditCardId?: null | string;
  type: TransactionType;
}

const CREDIT_KINDS: [SystemCategoryKey, ImportRowKind][] = [
  [SystemCategoryKey.CARD_REFUND, 'REFUND'],
  [SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT, 'PREPAYMENT_DISCOUNT'],
  [SystemCategoryKey.CARD_EARLY_PAYMENT, 'EARLY_PAYMENT'],
];
const INVOICE_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// Spec 048 FR 1-3: the kind of a row from its type, account/card and category.
export function importRowKind(row: KindRow): { error: ImportRowKindError } | ImportRowKind {
  const creditKind = CREDIT_KINDS.find(([key]) => SYSTEM_CATEGORY_IDS[key] === row.categoryId)?.[1];
  const isInvoicePayment =
    row.categoryId === SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVOICE_PAYMENT];
  const income = row.type === TransactionType.INCOME;

  if (creditKind || isInvoicePayment) {
    const fits = creditKind ? income : !income;

    if (!row.creditCardId || !fits) {
      return { error: 'CARD_CREDIT_CATEGORY_MISUSED' };
    }

    // Only the two payment kinds may name the account they are paid from.
    if (row.accountId && creditKind !== 'EARLY_PAYMENT' && !isInvoicePayment) {
      return { error: 'ACCOUNT_AND_CARD' };
    }

    return creditKind ?? 'INVOICE_PAYMENT';
  }

  if (row.accountId && row.creditCardId) {
    return { error: 'ACCOUNT_AND_CARD' };
  }

  if (row.creditCardId) {
    return income ? { error: 'CARD_INCOME_CATEGORY' } : 'CARD_PURCHASE';
  }

  return 'ACCOUNT_TRANSACTION';
}

// Spec 048 FR 4: rows the import leaves out (counted by the app, not errors).
export function isSkippableSystemRow(row: {
  accountId?: null | string;
  categoryId: string;
  creditCardId?: null | string;
}): boolean {
  return (
    row.categoryId === SYSTEM_CATEGORY_IDS[SystemCategoryKey.BALANCE_ADJUSTMENT] ||
    (row.categoryId === SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVOICE_PAYMENT] &&
      !!row.accountId &&
      !row.creditCardId)
  );
}

// `YYYY-MM`, `undefined` when absent, `'INVALID'` otherwise.
export function parseInvoiceMonth(raw?: null | string): 'INVALID' | string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  return INVOICE_MONTH.test(raw) ? raw : 'INVALID';
}
