import { InvestmentOperationType } from '@investment/domain/enum';

// Fixed ids seeded by the migration `investments_core`; finance mirrors them in `SYSTEM_CATEGORY_IDS` (a test pins both).
export const INVESTMENT_CONTRIBUTION_CATEGORY_ID = '00000000-0000-4000-8000-000000000009';
export const INVESTMENT_REDEMPTION_CATEGORY_ID = '00000000-0000-4000-8000-00000000000a';

export function categoryIdOf(type: InvestmentOperationType): string {
  return type === InvestmentOperationType.BUY
    ? INVESTMENT_CONTRIBUTION_CATEGORY_ID
    : INVESTMENT_REDEMPTION_CATEGORY_ID;
}
