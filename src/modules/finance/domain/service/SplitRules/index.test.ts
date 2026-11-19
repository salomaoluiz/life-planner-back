import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';

import {
  assertParts,
  assertTotal,
  netOf,
  SplitRuleError,
  SplitRulePart,
  totalOf,
  typeOf,
} from './index';

const ADJUSTMENT = SYSTEM_CATEGORY_IDS[SystemCategoryKey.SPLIT_ADJUSTMENT];

function codeOf(run: () => void): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as SplitRuleError).code;
  }

  return undefined;
}
function part(value: number, overrides: Partial<SplitRulePart> = {}): SplitRulePart {
  return { categoryId: 'cat', type: TransactionType.EXPENSE, value, ...overrides };
}

describe('netOf / totalOf / typeOf', () => {
  it('SHOULD subtract the expenses from the incomes (paycheck: +725075)', () => {
    const parts = [
      part(950000, { type: TransactionType.INCOME }),
      part(90885),
      part(102040),
      part(32000),
    ];

    expect(netOf(parts)).toBe(725075);
    expect(totalOf(parts)).toBe(725075);
    expect(typeOf(parts)).toBe(TransactionType.INCOME);
  });

  it('SHOULD sum a negative adjustment as a discount (12000 + 5000 - 440 = 16560)', () => {
    const parts = [part(12000), part(5000), part(-440, { categoryId: ADJUSTMENT })];

    expect(totalOf(parts)).toBe(16560);
    expect(typeOf(parts)).toBe(TransactionType.EXPENSE);
  });
});

describe('assertParts', () => {
  it('SHOULD accept 2 to 50 parts', () => {
    expect(() => assertParts([part(1), part(2)], { card: false })).not.toThrow();
    expect(() =>
      assertParts(
        Array.from({ length: 50 }, () => part(1)),
        { card: false },
      ),
    ).not.toThrow();
  });

  it.each([
    ['SPLIT_TOO_FEW_PARTS', [part(1)]],
    ['SPLIT_TOO_MANY_PARTS', Array.from({ length: 51 }, () => part(1))],
    ['SPLIT_PART_VALUE_INVALID', [part(1), part(-5)]],
    ['SPLIT_PART_VALUE_INVALID', [part(1), part(0)]],
    [
      'SPLIT_PART_VALUE_INVALID',
      [part(1), part(5, { categoryId: ADJUSTMENT, type: TransactionType.INCOME })],
    ],
    ['SPLIT_PART_VALUE_INVALID', [part(1), part(0, { categoryId: ADJUSTMENT })]],
    [
      'SPLIT_ADJUSTMENT_DUPLICATE',
      [part(10), part(-1, { categoryId: ADJUSTMENT }), part(2, { categoryId: ADJUSTMENT })],
    ],
    ['SPLIT_TOTAL_ZERO', [part(100, { type: TransactionType.INCOME }), part(100)]],
  ])('SHOULD throw %s', (code, parts) => {
    expect(codeOf(() => assertParts(parts, { card: false }))).toBe(code);
  });

  it('SHOULD refuse an income part on a card', () => {
    expect(
      codeOf(() =>
        assertParts([part(1), part(2, { type: TransactionType.INCOME })], { card: true }),
      ),
    ).toBe('SPLIT_CARD_EXPENSE_ONLY');
  });

  it('SHOULD allow one part with minParts 1 (dissolve) but never a lone adjustment', () => {
    expect(() => assertParts([part(1)], { card: false, minParts: 1 })).not.toThrow();
    expect(
      codeOf(() =>
        assertParts([part(-1, { categoryId: ADJUSTMENT })], { card: false, minParts: 1 }),
      ),
    ).toBe('SPLIT_PART_VALUE_INVALID');
  });
});

describe('assertTotal', () => {
  it('SHOULD accept a missing total and a matching one', () => {
    expect(() => assertTotal([part(10), part(5)], undefined)).not.toThrow();
    expect(() => assertTotal([part(10), part(5)], 15)).not.toThrow();
  });

  it('SHOULD report total, partsTotal and difference (typed 28000, parts 28440 -> -440)', () => {
    let error: SplitRuleError | undefined;

    try {
      assertTotal([part(28440)], 28000);
    } catch (caught) {
      error = caught as SplitRuleError;
    }

    expect(error?.code).toBe('SPLIT_TOTAL_MISMATCH');
    expect(error?.details).toEqual({ difference: -440, partsTotal: 28440, total: 28000 });
  });
});
