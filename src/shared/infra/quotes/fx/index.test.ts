import axios from 'axios';

import { FxRates } from './index';
import { envWith, mocks } from './index.mocks';

jest.mock('axios');

const getSpy = jest.mocked(axios.get);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FxRates.getUsdBrl', () => {
  it('SHOULD use brapi WHEN there is a token AND the plan returns the pair', async () => {
    getSpy.mockResolvedValueOnce({ data: mocks.brapi });

    const quote = await new FxRates(envWith('your-token')).getUsdBrl();

    expect(quote).toEqual({
      quotedAt: new Date(1762272100 * 1000),
      rate: '5.559900',
      source: 'BRAPI',
    });
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('SHOULD fall back to AwesomeAPI WHEN brapi fails or returns no pair', async () => {
    getSpy.mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce({ data: mocks.awesome });

    const quote = await new FxRates(envWith('your-token')).getUsdBrl();

    expect(quote).toMatchObject({ rate: '5.560100', source: 'AWESOMEAPI' });

    getSpy.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: mocks.awesome });
    expect((await new FxRates(envWith('your-token')).getUsdBrl()).source).toBe('AWESOMEAPI');
  });

  it('SHOULD go straight to AwesomeAPI WHEN there is no brapi token', async () => {
    getSpy.mockResolvedValueOnce({ data: mocks.awesome });

    await new FxRates(envWith()).getUsdBrl();

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy.mock.calls[0][0]).toContain('awesomeapi');
  });

  it('SHOULD use the fetch time WHEN the timestamp is missing', async () => {
    getSpy.mockResolvedValueOnce({ data: { USDBRL: { bid: '5.5' } } });

    const quote = await new FxRates(envWith()).getUsdBrl();

    expect(Number.isNaN(quote.quotedAt.getTime())).toBe(false);
  });

  it('SHOULD throw a source error WHEN AwesomeAPI has no rate or fails', async () => {
    getSpy.mockResolvedValueOnce({ data: {} });
    await expect(new FxRates(envWith()).getUsdBrl()).rejects.toThrow();

    getSpy.mockRejectedValueOnce({ response: { status: 503 } });
    await expect(new FxRates(envWith()).getUsdBrl()).rejects.toThrow('503');
  });
});
