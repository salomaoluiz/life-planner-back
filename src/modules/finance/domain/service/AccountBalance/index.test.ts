import { endOfMonth, withBalances } from './index';
import { mocks } from './index.mocks';

describe('endOfMonth', () => {
  it.each([
    ['2026-10-15', '2026-10-31'],
    ['2026-10-31', '2026-10-31'],
    ['2026-04-30', '2026-04-30'],
    ['2026-02-10', '2026-02-28'],
    ['2028-02-10', '2028-02-29'],
    ['2026-12-31', '2026-12-31'],
    ['2026-01-01', '2026-01-31'],
  ])('SHOULD turn %s into the last day of its month %s', (today, expected) => {
    expect(endOfMonth(today)).toBe(expected);
  });
});

describe('withBalances', () => {
  it('SHOULD equal the ledger WHEN there is no unpaid row due this month', () => {
    expect(withBalances(mocks.account)).toEqual({
      account: mocks.account,
      balance: 15000,
      projectedBalance: 15000,
    });
  });

  it('SHOULD keep the ledger as the current balance AND add the unpaid rows to the projection', () => {
    const result = withBalances(mocks.account, {
      accountId: mocks.account.id,
      dueByEndOfMonth: -400,
    });

    expect(result.balance).toBe(15000);
    expect(result.projectedBalance).toBe(14600);
  });
});
