import { measureRoundTrip } from './probe';

describe('measureRoundTrip', () => {
  it('SHOULD return the median of the timed runs after one warm-up', async () => {
    const ticks = [0, 5, 10, 11, 20, 23];
    const now = jest.fn(() => ticks.shift() ?? 0);
    const query = jest.fn(async () => undefined);
    expect(await measureRoundTrip(query, 3, now)).toBe(3);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('SHOULD reject WHEN the query rejects', async () => {
    await expect(
      measureRoundTrip(async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');
  });
});
