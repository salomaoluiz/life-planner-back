import { measureConcurrent, measureRoute } from './timing';

function fakeFetch(status = 200, body = 'abcde') {
  return jest.fn(async () => ({
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    ok: status < 300,
    status,
  })) as unknown as jest.MockedFunction<typeof fetch>;
}

function clock(step: number[]) {
  let t = 0;
  let i = 0;
  // Each call to now() alternates start/end: end - start = next step value.
  return () => {
    const value = t;
    t += i % 2 === 0 ? step[(i / 2) % step.length] : 1;
    i += 1;

    return value;
  };
}

describe('measureRoute', () => {
  it('SHOULD warm up twice, measure 7 and return median and bytes', async () => {
    const fetchFn = fakeFetch();
    const result = await measureRoute({
      baseUrl: 'http://x',
      fetchFn,
      key: 'GET /a',
      now: clock([10, 20, 30, 40, 50, 60, 70, 80, 90]),
      path: '/a',
      token: 't',
    });
    expect(fetchFn).toHaveBeenCalledTimes(9);
    expect(result.bytes).toBe(5);
    expect(result.p50).toBeGreaterThan(0);
  });

  it('SHOULD name the key and status, not the body, on non-2xx', async () => {
    await expect(
      measureRoute({
        baseUrl: 'http://x',
        fetchFn: fakeFetch(500, 'secret'),
        key: 'GET /a',
        path: '/a',
        token: 't',
      }),
    ).rejects.toThrow(/^GET \/a -> 500$/);
  });
});

describe('measureConcurrent', () => {
  it('SHOULD fire calls x repeat at once and return one wall time', async () => {
    const fetchFn = fakeFetch();
    const result = await measureConcurrent({
      baseUrl: 'http://x',
      calls: [{ path: '/a' }, { path: '/b' }, { path: '/c' }, { path: '/d' }],
      fetchFn,
      repeat: 3,
      token: 't',
    });
    expect(fetchFn).toHaveBeenCalledTimes(12);
    expect(result.wallMs).toBeGreaterThanOrEqual(0);
  });
});
