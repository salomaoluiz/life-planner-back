import { FinanceRecurrenceMapper } from './index';
import { mocks } from './index.mocks';

describe('FinanceRecurrenceMapper.toDomain', () => {
  it('SHOULD map columns, summaries, calendar dates AND the total of the series', () => {
    expect(FinanceRecurrenceMapper.toDomain(mocks.raw)).toEqual({
      account: { icon: 'bank', id: mocks.raw.account?.id, name: 'Checking' },
      accountId: mocks.raw.account_id,
      category: {
        excludeFromTotals: false,
        icon: 'home',
        iconColor: '#2E7D32',
        id: mocks.raw.category.id,
        name: 'Rent',
        systemKey: null,
      },
      categoryId: mocks.raw.category_id,
      createdAt: mocks.raw.created_at,
      creditCard: null,
      creditCardId: null,
      currency: 'BRL' as const,
      description: 'Rent',
      endDate: '2027-09-05',
      firstNumber: 1,
      frequency: 'MONTHLY',
      id: mocks.raw.id,
      lastGeneratedNumber: 1,
      nextOccurrenceDate: '2026-11-05',
      occurrenceCount: 12,
      owner: 'USER',
      ownerId: mocks.raw.owner_id,
      skippedNumbers: [3],
      startDate: '2026-10-05',
      status: 'ACTIVE',
      tags: [],
      type: 'EXPENSE',
      updatedAt: mocks.raw.updated_at,
      value: 200000,
    });
  });

  it('SHOULD map a card series without end date AND without next occurrence', () => {
    const raw = {
      ...mocks.raw,
      account: null,
      account_id: null,
      credit_card: { color: '#112233', id: 'card-1', last_digits: null, title: 'Card' },
      credit_card_id: 'card-1',
      end_date: null,
      next_occurrence_date: null,
      status: 'ENDED' as const,
    };

    expect(FinanceRecurrenceMapper.toDomain(raw)).toMatchObject({
      account: null,
      creditCard: { color: '#112233', id: 'card-1', lastDigits: undefined, title: 'Card' },
      endDate: null,
      nextOccurrenceDate: null,
      occurrenceCount: null,
      status: 'ENDED',
    });
  });

  it('SHOULD keep the system key of a system category', () => {
    const raw = {
      ...mocks.raw,
      category: { ...mocks.raw.category, system_key: 'CARD_REFUND' as const },
    };

    expect(FinanceRecurrenceMapper.toDomain(raw).category.systemKey).toBe('CARD_REFUND');
  });
});
