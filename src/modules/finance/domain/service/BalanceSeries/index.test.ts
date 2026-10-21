import { balancesAtEnds, totalOf } from './index';

describe('balancesAtEnds', () => {
  const accounts = [
    { accountId: 'a', ledger: 1000 },
    { accountId: 'b', ledger: 500 },
  ];
  const paid = [
    { accountId: 'a', amount: 300, date: '2026-10-10' },
    { accountId: 'a', amount: -100, date: '2026-10-20' },
    { accountId: 'b', amount: 50, date: '2026-10-20' },
  ];

  it('SHOULD take back the paid rows dated after each end', () => {
    const [before, middle, after] = balancesAtEnds(accounts, paid, [
      '2026-10-09',
      '2026-10-15',
      '2026-10-20',
    ]);

    expect(totalOf(before)).toBe(1500 - 300 + 100 - 50);
    expect(middle).toEqual([
      { accountId: 'a', balance: 1100 },
      { accountId: 'b', balance: 450 },
    ]);
    expect(totalOf(after)).toBe(1500);
  });

  it('SHOULD return no balances without accounts', () => {
    expect(balancesAtEnds([], paid, ['2026-10-09'])).toEqual([[]]);
    expect(totalOf([])).toBe(0);
  });
});
