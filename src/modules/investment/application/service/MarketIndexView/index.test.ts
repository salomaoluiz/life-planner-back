import {
  InvestmentFixedIncomeRateMode,
  MarketIndex,
  MarketIndexSeries,
} from '@investment/domain/enum';

import {
  buildSummary,
  changeDateOf,
  toChanges,
  toFollowers,
  toIpcaPoints,
  toStepPoints,
} from './index';

const TODAY = '2026-11-16';

function fetches(at: null | string) {
  return [
    {
      lastAttemptAt: null,
      lastError: null,
      lastSuccessAt: at ? new Date(at) : null,
      series: MarketIndexSeries.CDI_DAILY,
    },
  ];
}
function latest(entries: [MarketIndexSeries, string, string][]) {
  return new Map(entries.map(([series, date, value]) => [series, { date, value }]));
}

describe('step points and changes', () => {
  const rows = [
    { date: '2025-12-11', value: '13.65000000' },
    { date: '2025-12-12', value: '13.65' },
    { date: '2026-03-19', value: '14.15' },
    { date: '2026-06-18', value: '14.90' },
    { date: '2026-06-19', value: '14.9000' },
  ];

  it('SHOULD keep one point per change of the value rounded to 2 places', () => {
    expect(toStepPoints(rows)).toEqual([
      { date: '2025-12-11', value: '13.65' },
      { date: '2026-03-19', value: '14.15' },
      { date: '2026-06-18', value: '14.90' },
    ]);
  });

  it('SHOULD list the changes newest first with the delta (null for the first point)', () => {
    expect(toChanges(toStepPoints(rows))).toEqual([
      { delta: '0.75', since: '2026-06-18', value: '14.90' },
      { delta: '0.50', since: '2026-03-19', value: '14.15' },
      { delta: null, since: '2025-12-11', value: '13.65' },
    ]);
  });

  it('SHOULD find the first date of the current run of equal values', () => {
    expect(changeDateOf(rows)).toBe('2026-06-18');
    expect(changeDateOf([])).toBeNull();
    expect(changeDateOf([{ date: '2026-01-02', value: '15' }])).toBe('2026-01-02');
  });
});

describe('toIpcaPoints', () => {
  it('SHOULD join the monthly IPCA with the 12 month accumulated one by month', () => {
    expect(
      toIpcaPoints(
        [
          { date: '2026-09-01', value: '0.82' },
          { date: '2026-10-01', value: '0.14' },
        ],
        [{ date: '2026-10-01', value: '4.63' }],
      ),
    ).toEqual([
      { accumulated12m: null, month: '2026-09', monthly: '0.82' },
      { accumulated12m: '4.63', month: '2026-10', monthly: '0.14' },
    ]);
  });
});

describe('buildSummary', () => {
  const base = {
    changeDates: { cdi: '2026-06-18', selic: '2026-06-18' },
    fetches: fetches('2026-11-12T13:10:00Z'),
    followers: [
      {
        assetId: 'a',
        cdiPercent: '110',
        mode: InvestmentFixedIncomeRateMode.CDI_PERCENT,
        name: 'A',
        spread: null,
      },
      {
        assetId: 'b',
        cdiPercent: '95',
        mode: InvestmentFixedIncomeRateMode.CDI_PERCENT,
        name: 'B',
        spread: null,
      },
      {
        assetId: 'c',
        cdiPercent: null,
        mode: InvestmentFixedIncomeRateMode.IPCA_PLUS,
        name: 'C',
        spread: '6',
      },
    ],
    fx: [{ pair: 'USD-BRL', quotedAt: new Date('2026-11-12T11:05:00Z'), rate: '5.350000' }],
    today: TODAY,
  };

  it('SHOULD return null indexes AND a null last success BEFORE the first run', () => {
    const summary = buildSummary({
      ...base,
      changeDates: { cdi: null, selic: null },
      fetches: [],
      followers: [],
      fx: [],
      latest: new Map(),
    });

    expect(summary).toEqual({ cdi: null, fx: [], ipca: null, lastSuccessAt: null, selic: null });
  });

  it('SHOULD format the latest values, mark staleness AND count the followers by index', () => {
    const summary = buildSummary({
      ...base,
      latest: latest([
        [MarketIndexSeries.CDI_ANNUAL, '2026-11-11', '14.9'],
        [MarketIndexSeries.CDI_DAILY, '2026-11-11', '0.055131'],
        [MarketIndexSeries.SELIC_TARGET, '2026-11-11', '15'],
        [MarketIndexSeries.SELIC_DAILY, '2026-11-11', '0.05546'],
        [MarketIndexSeries.IPCA_MONTHLY, '2026-10-01', '0.32'],
        [MarketIndexSeries.IPCA_12M, '2026-10-01', '4.68'],
        [MarketIndexSeries.IPCA_EXPECTED_12M, '2026-11-11', '4.2'],
      ]),
    });

    expect(summary.cdi).toEqual({
      annual: '14.90',
      daily: '0.05513100',
      date: '2026-11-11',
      followers: 2,
      lastChangeDate: '2026-06-18',
      stale: false,
    });
    expect(summary.selic).toMatchObject({ daily: '0.05546000', followers: 0, target: '15.00' });
    expect(summary.ipca).toEqual({
      accumulated12m: '4.68',
      expected12m: '4.20',
      expectedDate: '2026-11-11',
      followers: 1,
      month: '2026-10',
      monthly: '0.32',
      stale: false,
    });
    expect(summary.fx).toEqual([
      { pair: 'USD-BRL', quotedAt: '2026-11-12T11:05:00.000Z', rate: '5.350000' },
    ]);
    expect(summary.lastSuccessAt).toBe('2026-11-12T13:10:00.000Z');
  });

  it('SHOULD mark an index stale WHEN its main series is older than allowed', () => {
    const summary = buildSummary({
      ...base,
      latest: latest([
        [MarketIndexSeries.CDI_ANNUAL, '2026-11-02', '14.9'],
        [MarketIndexSeries.CDI_DAILY, '2026-11-02', '0.055131'],
      ]),
    });

    expect(summary.cdi?.stale).toBe(true);
    expect(summary.ipca).toBeNull();
  });
});

describe('toFollowers', () => {
  const followers = [
    {
      assetId: 'a',
      cdiPercent: '110',
      mode: InvestmentFixedIncomeRateMode.CDI_PERCENT,
      name: 'A',
      spread: null,
    },
    {
      assetId: 'c',
      cdiPercent: null,
      mode: InvestmentFixedIncomeRateMode.IPCA_PLUS,
      name: 'C',
      spread: '6',
    },
  ];

  it('SHOULD list the titles that follow the index with their percent or spread', () => {
    expect(toFollowers(MarketIndex.CDI, followers)).toEqual([
      { assetId: 'a', name: 'A', percent: '110' },
    ]);
    expect(toFollowers(MarketIndex.IPCA, followers)).toEqual([
      { assetId: 'c', name: 'C', spread: '6' },
    ]);
    expect(toFollowers(MarketIndex.SELIC, followers)).toEqual([]);
  });

  it('SHOULD cap the list at 50', () => {
    const many = Array.from({ length: 60 }, (_, index) => ({
      ...followers[0],
      assetId: `a-${index}`,
    }));

    expect(toFollowers(MarketIndex.CDI, many)).toHaveLength(50);
  });
});
