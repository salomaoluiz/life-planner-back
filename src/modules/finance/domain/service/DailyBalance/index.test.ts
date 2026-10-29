import { buildDailyBalances, DailyBalanceInput } from './index';

const base: DailyBalanceInput = {
  accounts: [{ accountId: 'a', opening: 1000 }],
  cardsDue: [],
  month: '2026-11',
  paid: [],
  pending: [],
  today: '2026-11-15',
};
function balanceOn(days: ReturnType<typeof buildDailyBalances>, date: string, id = 'a') {
  return days.find((day) => day.date === date)?.accounts.find((account) => account.accountId === id)
    ?.balance;
}

describe('buildDailyBalances', () => {
  it('SHOULD return one item per calendar day for months of 28, 29, 30 and 31 days', () => {
    expect(buildDailyBalances({ ...base, month: '2026-02' })).toHaveLength(28);
    expect(buildDailyBalances({ ...base, month: '2028-02' })).toHaveLength(29);
    expect(buildDailyBalances({ ...base, month: '2026-11' })).toHaveLength(30);
    expect(buildDailyBalances({ ...base, month: '2026-12' })).toHaveLength(31);
  });

  it('SHOULD apply a paid row from its own date on', () => {
    const days = buildDailyBalances({
      ...base,
      paid: [{ accountId: 'a', amount: -300, date: '2026-11-10' }],
    });

    expect(balanceOn(days, '2026-11-09')).toBe(1000);
    expect(balanceOn(days, '2026-11-10')).toBe(700);
    expect(balanceOn(days, '2026-11-30')).toBe(700);
  });

  it('SHOULD subtract an overdue unpaid row from today on, not on the past days', () => {
    const days = buildDailyBalances({
      ...base,
      pending: [{ accountId: 'a', amount: -200, date: '2026-11-03' }],
    });

    expect(balanceOn(days, '2026-11-03')).toBe(1000);
    expect(balanceOn(days, '2026-11-14')).toBe(1000);
    expect(balanceOn(days, '2026-11-15')).toBe(800);
  });

  it('SHOULD add an unpaid income from its date and mark the days as projected', () => {
    const days = buildDailyBalances({
      ...base,
      pending: [{ accountId: 'a', amount: 500, date: '2026-11-20' }],
    });

    expect(balanceOn(days, '2026-11-19')).toBe(1000);
    expect(balanceOn(days, '2026-11-20')).toBe(1500);
    expect(days.find((day) => day.date === '2026-11-19')?.projected).toBe(false);
    expect(days.find((day) => day.date === '2026-11-20')?.projected).toBe(true);
  });

  it('SHOULD count an unpaid row dated today on today without marking it projected', () => {
    const days = buildDailyBalances({
      ...base,
      pending: [{ accountId: 'a', amount: -100, date: '2026-11-15' }],
    });

    expect(balanceOn(days, '2026-11-15')).toBe(900);
    expect(days.find((day) => day.date === '2026-11-15')?.projected).toBe(false);
  });

  it('SHOULD ignore pending items on every day of a month fully in the past', () => {
    const days = buildDailyBalances({
      ...base,
      month: '2026-09',
      pending: [{ accountId: 'a', amount: -200, date: '2026-09-10' }],
    });

    expect(days.every((day) => day.accounts[0].balance === 1000)).toBe(true);
    expect(days.some((day) => day.projected)).toBe(false);
  });

  it('SHOULD count pending items dated before a future month from its first day', () => {
    const days = buildDailyBalances({
      ...base,
      month: '2026-12',
      pending: [{ accountId: 'a', amount: -50, date: '2026-11-20' }],
    });

    expect(balanceOn(days, '2026-12-01')).toBe(950);
    expect(days[0].projected).toBe(true);
  });

  it('SHOULD put an invoice due in cardsDue and in the total from its day', () => {
    const days = buildDailyBalances({
      ...base,
      cardsDue: [{ amount: -450, date: '2026-11-25' }],
    });
    const day = days.find((item) => item.date === '2026-11-25');

    expect(days.find((item) => item.date === '2026-11-24')?.cardsDue).toBe(0);
    expect(day?.cardsDue).toBe(-450);
    expect(day?.total).toBe(550);
    expect(day?.projected).toBe(true);
  });

  it('SHOULD keep the input order and keep zero-balance accounts', () => {
    const days = buildDailyBalances({
      ...base,
      accounts: [
        { accountId: 'b', opening: 0 },
        { accountId: 'a', opening: 10 },
      ],
    });

    expect(days[0].accounts).toEqual([
      { accountId: 'b', balance: 0 },
      { accountId: 'a', balance: 10 },
    ]);
    expect(days[0].total).toBe(10);
  });

  it('SHOULD return zeros without accounts', () => {
    const days = buildDailyBalances({ ...base, accounts: [] });

    expect(days[0]).toEqual({
      accounts: [],
      cardsDue: 0,
      date: '2026-11-01',
      projected: false,
      total: 0,
    });
  });
});

describe('buildDailyBalances over several months (spec 053)', () => {
  it('SHOULD return every day up to the last month AND apply a pending item from its date', () => {
    const days = buildDailyBalances({
      accounts: [{ accountId: 'a', opening: 1000 }],
      cardsDue: [],
      lastMonth: '2026-12',
      month: '2026-11',
      paid: [],
      pending: [{ accountId: 'a', amount: -300, date: '2026-12-10' }],
      today: '2026-10-20',
    });

    expect(days).toHaveLength(30 + 31);
    expect(days.find((d) => d.date === '2026-12-09')?.accounts[0].balance).toBe(1000);
    expect(days.find((d) => d.date === '2026-12-10')?.accounts[0].balance).toBe(700);
    expect(days[days.length - 1].date).toBe('2026-12-31');
  });
});
