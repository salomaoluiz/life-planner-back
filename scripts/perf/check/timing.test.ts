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
  it('SHOULD return wireBytes as the gzip size of the body (spec 072)', async () => {
    const result = await measureRoute({
      baseUrl: 'http://x',
      fetchFn: fakeFetch(200, 'a'.repeat(5000)),
      key: 'GET /a',
      path: '/a',
      token: 't',
    });

    expect(result.bytes).toBe(5000);
    expect(result.wireBytes).toBeGreaterThan(0);
    expect(result.wireBytes).toBeLessThan(100);
  });

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
    expect(fetchFn).toHaveBeenCalledTimes(13);
    expect(result.wallMs).toBeGreaterThanOrEqual(0);
    expect(result.maxPoolWaiting).toBeUndefined();
  });

  it('SHOULD reset the pool max with the first call AND return the highest header value', async () => {
    const waiting = ['0', '5', '2'];
    const fetchFn = jest.fn(async (_url: unknown, _init?: unknown) => ({
      arrayBuffer: async () => new ArrayBuffer(1),
      headers: { get: () => waiting.shift() ?? '1' },
      ok: true,
      status: 200,
    })) as unknown as jest.MockedFunction<typeof fetch>;

    const result = await measureConcurrent({
      baseUrl: 'http://x',
      calls: [{ path: '/a' }, { path: '/b' }],
      fetchFn,
      repeat: 2,
      token: 't',
    });

    expect(fetchFn.mock.calls[0][1]).toMatchObject({ headers: { 'x-perf-reset-pool': '1' } });
    expect(fetchFn.mock.calls[1][1]).not.toMatchObject({
      headers: { 'x-perf-reset-pool': '1' },
    });
    expect(result.maxPoolWaiting).toBe(5);
  });
});
