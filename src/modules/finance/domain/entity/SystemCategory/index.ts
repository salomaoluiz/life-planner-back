import { SystemCategoryKey } from '@finance/domain/enum';

// Fixed ids seeded by the migration `account_balance_from_transactions`: system categories are
// created by migration only, so the ids are known here and no lookup is needed to recognise one.
export const SYSTEM_CATEGORY_IDS: Record<SystemCategoryKey, string> = {
  [SystemCategoryKey.BALANCE_ADJUSTMENT]: '00000000-0000-4000-8000-000000000001',
  [SystemCategoryKey.INVOICE_PAYMENT]: '00000000-0000-4000-8000-000000000002',
};

// Stored description of every balance adjustment; the app shows a translated label from the key.
export const BALANCE_ADJUSTMENT_DESCRIPTION = 'Balance adjustment';

export function isSystemCategoryId(id: string): boolean {
  return Object.values(SYSTEM_CATEGORY_IDS).includes(id);
}

// Stored description of every invoice payment transaction; the app shows a translated label from the key.
export const INVOICE_PAYMENT_DESCRIPTION = 'Invoice payment';
