import { SystemCategoryKey } from '@finance/domain/enum';

// Fixed ids seeded by the migration `account_balance_from_transactions`: system categories are
// created by migration only, so the ids are known here and no lookup is needed to recognise one.
export const SYSTEM_CATEGORY_IDS: Record<SystemCategoryKey, string> = {
  [SystemCategoryKey.BALANCE_ADJUSTMENT]: '00000000-0000-4000-8000-000000000001',
  [SystemCategoryKey.CARD_EARLY_PAYMENT]: '00000000-0000-4000-8000-000000000005',
  [SystemCategoryKey.CARD_REFUND]: '00000000-0000-4000-8000-000000000004',
  [SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT]: '00000000-0000-4000-8000-000000000003',
  [SystemCategoryKey.INVOICE_PAYMENT]: '00000000-0000-4000-8000-000000000002',
};

// The only INCOME categories a card row may have (spec 032 FR 3).
export const CARD_CREDIT_KEYS: SystemCategoryKey[] = [
  SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT,
  SystemCategoryKey.CARD_REFUND,
  SystemCategoryKey.CARD_EARLY_PAYMENT,
];

export function isCardCreditCategoryId(id: string): boolean {
  return CARD_CREDIT_KEYS.some((key) => SYSTEM_CATEGORY_IDS[key] === id);
}

// Stored description of every balance adjustment; the app shows a translated label from the key.
export const BALANCE_ADJUSTMENT_DESCRIPTION = 'Balance adjustment';

export function isSystemCategoryId(id: string): boolean {
  return Object.values(SYSTEM_CATEGORY_IDS).includes(id);
}

// Stored description of every invoice payment transaction; the app shows a translated label from the key.
export const INVOICE_PAYMENT_DESCRIPTION = 'Invoice payment';
