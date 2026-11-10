import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';
import { InvestmentOperationType } from '@investment/domain/enum';

import {
  categoryIdOf,
  INVESTMENT_CONTRIBUTION_CATEGORY_ID,
  INVESTMENT_REDEMPTION_CATEGORY_ID,
} from './index';

describe('SystemCategories', () => {
  it('SHOULD match the ids finance seeds for the two investment keys', () => {
    expect(INVESTMENT_CONTRIBUTION_CATEGORY_ID).toBe(
      SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVESTMENT_CONTRIBUTION],
    );
    expect(INVESTMENT_REDEMPTION_CATEGORY_ID).toBe(
      SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVESTMENT_REDEMPTION],
    );
  });

  it('SHOULD use the contribution for a buy AND the redemption for a sell', () => {
    expect(categoryIdOf(InvestmentOperationType.BUY)).toBe(INVESTMENT_CONTRIBUTION_CATEGORY_ID);
    expect(categoryIdOf(InvestmentOperationType.SELL)).toBe(INVESTMENT_REDEMPTION_CATEGORY_ID);
  });
});
