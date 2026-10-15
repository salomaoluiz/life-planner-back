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
  it('SHOULD equal the ledger WHEN there is no future-dated row', () => {
    expect(withBalances(mocks.account)).toEqual({
      account: mocks.account,
      balance: 15000,
      projectedBalance: 15000,
    });
  });

  it('SHOULD subtract the signed future rows: current drops everything after today, projected only what is after the month end', () => {
    // Ledger 15000 includes a +1000 income dated later this month and a -400 expense next month.
    const result = withBalances(mocks.account, {
      accountId: mocks.account.id,
      afterEndOfMonth: -400,
      afterToday: 600,
    });

    expect(result.balance).toBe(14400);
    expect(result.projectedBalance).toBe(15400);
  });

  it('SHOULD make projected equal current WHEN today is the last day of the month (nothing is between today and month end)', () => {
    const result = withBalances(mocks.account, {
      accountId: mocks.account.id,
      afterEndOfMonth: 250,
      afterToday: 250,
    });

    expect(result.balance).toBe(result.projectedBalance);
  });
});
