import { SystemCategoryKey } from '@finance/domain/enum';

import { FinanceTransactionMapper } from './index';
import { mocks } from './index.mocks';

describe('FinanceTransactionMapper.toDomain', () => {
  it('SHOULD map columns, embed the account / category summaries AND turn the date into YYYY-MM-DD', () => {
    expect(FinanceTransactionMapper.toDomain(mocks.raw)).toEqual({
      account: { icon: 'bank', id: mocks.raw.account.id, name: 'Checking' },
      accountId: mocks.raw.account_id,
      category: {
        excludeFromTotals: false,
        icon: 'cart',
        iconColor: '#2E7D32',
        id: mocks.raw.category.id,
        name: 'Groceries',
        systemKey: null,
      },
      categoryId: mocks.raw.category_id,
      createdAt: mocks.raw.created_at,
      date: '2026-10-03',
      description: 'Weekly groceries',
      id: mocks.raw.id,
      owner: 'FAMILY',
      ownerId: mocks.raw.owner_id,
      type: 'EXPENSE',
      updatedAt: mocks.raw.updated_at,
      value: 23490,
    });
  });

  it('SHOULD keep the same calendar day for a date stored at the very end of the UTC day', () => {
    const raw = { ...mocks.raw, date: new Date('2026-10-03T23:59:59.999Z') };

    expect(FinanceTransactionMapper.toDomain(raw).date).toBe('2026-10-03');
  });
});

it('SHOULD map a system category: its key as the enum AND excludeFromTotals', () => {
  const result = FinanceTransactionMapper.toDomain({
    ...mocks.raw,
    category: {
      ...mocks.raw.category,
      exclude_from_totals: true,
      name: 'Balance adjustment',
      system_key: 'BALANCE_ADJUSTMENT',
    },
  });

  expect(result.category.systemKey).toBe(SystemCategoryKey.BALANCE_ADJUSTMENT);
  expect(result.category.excludeFromTotals).toBe(true);
});
