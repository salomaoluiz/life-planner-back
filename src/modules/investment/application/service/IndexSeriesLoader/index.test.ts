import { EMPTY_INDEXES } from '@investment/domain/service/IndexSeries';

import { IndexSeriesLoader } from './index';

const findSeriesData = jest.fn();

describe('IndexSeriesLoader', () => {
  it('SHOULD read the series from the given date in one repository call', async () => {
    findSeriesData.mockResolvedValue(EMPTY_INDEXES);

    const series = await new IndexSeriesLoader({ findSeriesData } as never).load('2026-01-02');

    expect(series).toBe(EMPTY_INDEXES);
    expect(findSeriesData).toHaveBeenCalledWith('2026-01-02');
  });
});
