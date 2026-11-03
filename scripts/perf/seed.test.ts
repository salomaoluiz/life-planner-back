import { DEFAULT_PERF_EMAIL, loadConfig, parseArgs, runSeed } from './seed';
import { SeedRefusal } from './seed/safety';

const env = {
  NODE_ENV: 'development',
  PERF_SEED_ALLOW: 'staging',
  PERF_USER_EMAIL: 'perf@example.com',
  PERF_USER_PASSWORD: 'perf-pass-123',
};

function fakeClient() {
  return {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockImplementation(async (path: string) => {
      if (path === '/api/v1/user/me') return { email: 'perf@example.com', id: 'u1' };
      if (path === '/api/v1/families') return [{ id: 'f1', name: 'Perf family 1' }];
      return [];
    }),
    login: jest.fn().mockResolvedValue(undefined),
    post: jest.fn(),
    signup: jest.fn().mockResolvedValue(undefined),
  };
}

function runners() {
  return {
    family: jest.fn().mockResolvedValue({ counts: { families: 1 }, familyIds: ['f1'] }),
    finance: jest
      .fn()
      .mockResolvedValue({ counts: { transactions: 5 }, referenceMonth: '2026-10' }),
    stock: jest.fn().mockResolvedValue({ counts: { stock: 2 } }),
  };
}

describe('parseArgs', () => {
  it('reads module and reset', () => {
    expect(parseArgs(['--module', 'stock', '--reset'])).toEqual({ module: 'stock', reset: true });
    expect(parseArgs(['--module=family'])).toEqual({ module: 'family', reset: false });
    expect(parseArgs([])).toEqual({ module: undefined, reset: false });
  });

  it('refuses an unknown module', () => {
    expect(() => parseArgs(['--module', 'x'])).toThrow(SeedRefusal);
  });
});

describe('runSeed', () => {
  it('writes nothing when the gate refuses', async () => {
    const client = fakeClient();
    const run = runners();

    await expect(
      runSeed([], { ...env, PERF_SEED_ALLOW: '' }, client as never, run, () => undefined),
    ).rejects.toBeInstanceOf(SeedRefusal);

    expect(client.login).not.toHaveBeenCalled();
    expect(run.stock).not.toHaveBeenCalled();
  });

  it('runs every module and returns the manifest', async () => {
    const run = runners();

    const manifest = await runSeed([], env, fakeClient() as never, run, () => undefined);

    expect(run.family).toHaveBeenCalled();
    expect(run.stock).toHaveBeenCalled();
    expect(run.finance).toHaveBeenCalled();
    expect(manifest).toMatchObject({
      counts: { families: 1, stock: 2, transactions: 5 },
      familyIds: ['f1'],
      referenceMonth: '2026-10',
      userId: 'u1',
    });
  });

  it('uses the pinned anchorDate as today, whatever the real date is (spec 093)', async () => {
    const run = runners();

    await runSeed([], env, fakeClient() as never, run, () => undefined, new Date('2031-05-05'));

    expect(run.stock.mock.calls[0][0].today).toBe(loadConfig().anchorDate);
    expect(loadConfig().anchorDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('logs in as the default base user WHEN PERF_USER_EMAIL is unset or empty', async () => {
    for (const email of [undefined, '']) {
      const client = fakeClient();
      client.get.mockImplementation(async (path: string) =>
        path === '/api/v1/user/me' ? { email: DEFAULT_PERF_EMAIL, id: 'u1' } : [],
      );

      await runSeed(
        [],
        { ...env, PERF_USER_EMAIL: email },
        client as never,
        runners(),
        () => undefined,
      );

      expect(client.login).toHaveBeenCalledWith(DEFAULT_PERF_EMAIL, env.PERF_USER_PASSWORD);
    }
  });

  it('--module stock runs only the stock runner', async () => {
    const run = runners();

    await runSeed(['--module', 'stock'], env, fakeClient() as never, run, () => undefined);

    expect(run.stock).toHaveBeenCalled();
    expect(run.family).not.toHaveBeenCalled();
    expect(run.finance).not.toHaveBeenCalled();
  });

  it('signs up when the first login fails', async () => {
    const client = fakeClient();
    client.login.mockRejectedValueOnce(new Error('POST x -> 401'));

    await runSeed(['--module', 'stock'], env, client as never, runners(), () => undefined);

    expect(client.signup).toHaveBeenCalledTimes(1);
    expect(client.login).toHaveBeenCalledTimes(2);
  });

  it('--reset deletes the account first', async () => {
    const client = fakeClient();

    await runSeed(
      ['--module', 'stock', '--reset'],
      env,
      client as never,
      runners(),
      () => undefined,
    );

    expect(client.delete).toHaveBeenCalledWith('/api/v1/user/me', { email: 'perf@example.com' });
  });

  it('never logs the email, password or host', async () => {
    const lines: string[] = [];

    await runSeed([], env, fakeClient() as never, runners(), (line) => lines.push(line));

    const output = lines.join('\n');
    expect(output).toMatch(/stock/);
    expect(output).toMatch(/ms|s\b/);
    expect(output).not.toMatch(/perf@example|perf-pass|localhost|token/i);
  });
});
