import { indexWindowStart, toIndexSeriesData } from './index';

function row(series: string, date: string, value: string) {
  return { date: new Date(`${date}T00:00:00.000Z`), series, value };
}

describe('IndexSeriesMapper', () => {
  it('SHOULD start the window 10 days or the month before from, whichever is earlier', () => {
    expect(indexWindowStart('2026-03-20')).toEqual(new Date('2026-03-01T00:00:00.000Z'));
    expect(indexWindowStart('2026-03-05')).toEqual(new Date('2026-02-23T00:00:00.000Z'));
  });

  it('SHOULD split the rows by series AND use the fallback expectation only when none is inside', () => {
    const rows = [row('CDI_DAILY', '2026-03-02', '0.05'), row('IPCA_MONTHLY', '2026-03-01', '0.5')];
    const fallback = row('IPCA_EXPECTED_12M', '2026-01-05', '3.9');

    expect(toIndexSeriesData(rows, fallback)).toEqual({
      cdiDaily: [{ date: '2026-03-02', value: 0.05 }],
      ipcaExpected: [{ date: '2026-01-05', value: 3.9 }],
      ipcaMonthly: [{ date: '2026-03-01', value: 0.5 }],
    });
    expect(
      toIndexSeriesData([...rows, row('IPCA_EXPECTED_12M', '2026-03-10', '4.2')], fallback)
        .ipcaExpected,
    ).toEqual([{ date: '2026-03-10', value: 4.2 }]);
    expect(toIndexSeriesData([]).ipcaExpected).toEqual([]);
  });
});
