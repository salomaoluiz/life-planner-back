import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadRegistry } from '../registry';
import { applyCheckBaseline, CheckDeps, checkMain } from './run';
import { measureConcurrent, measureRoute } from './timing';
import { loadConcurrency } from './concurrency';

jest.mock('./timing');
jest.mock('./concurrency');
jest.mock('../registry', () => ({
  ...jest.requireActual('../registry'),
  loadRegistry: jest.fn(),
}));

const entry = {
  indexes: null,
  kind: 'read',
  knownException: undefined,
  maxBytes: null,
  maxQueries: 1,
  p50Ms: 100,
  scenario: '',
};
const ENV = { DB_HOST: 'localhost', PERF_SEED_ALLOW: 'staging' };
const KEY = 'GET /api/v1/stock/items';

function makeDeps(overrides: Partial<CheckDeps> = {}) {
  const stop = jest.fn(async () => undefined);
  const deps = {
    applyBaseline: jest.fn(),
    applyWall: jest.fn(),
    build: jest.fn(() => 0),
    explain: jest.fn(async () => []),
    log: jest.fn(),
    login: jest.fn(async () => ({
      fixtures: { referenceMonth: '2026-10', userId: 'u' },
      token: 't',
    })),
    startServer: jest.fn(() => ({ child: {}, stop })),
    waitHealthy: jest.fn(async () => undefined),
    writeSummary: jest.fn(),
    ...overrides,
  } as unknown as CheckDeps & { [K in keyof CheckDeps]: jest.Mock };

  return { deps, stop };
}

function registryWith(overrides: Record<string, unknown> = {}) {
  (loadRegistry as jest.Mock).mockReturnValue({
    stock: { [KEY]: { ...entry, ...overrides } },
  });
  (loadConcurrency as jest.Mock).mockReturnValue({});
}

describe('checkMain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registryWith();
    (measureRoute as jest.Mock).mockResolvedValue({ bytes: 1000, p50: 100 });
    (measureConcurrent as jest.Mock).mockResolvedValue({ wallMs: 10 });
  });

  it('SHOULD exit 2 WHEN the build fails', async () => {
    const { deps } = makeDeps({ build: jest.fn(() => 1) });
    expect(await checkMain(['--module', 'stock'], ENV, deps)).toBe(2);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('build failed'));
  });

  it('SHOULD exit 2 WHEN the safety gate refuses', async () => {
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock'], {}, deps)).toBe(2);
    expect(deps.build).not.toHaveBeenCalled();
  });

  it('SHOULD exit 2 and still stop the server WHEN it never gets healthy', async () => {
    const { deps, stop } = makeDeps({
      waitHealthy: jest.fn(async () => {
        throw new Error('API did not become healthy on http://x');
      }),
    });
    expect(await checkMain(['--module', 'stock'], ENV, deps)).toBe(2);
    expect(stop).toHaveBeenCalled();
  });

  it('SHOULD pass WHEN within the baseline', async () => {
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock'], ENV, deps)).toBe(0);
  });

  it('SHOULD fail naming the route WHEN p50 regresses', async () => {
    (measureRoute as jest.Mock).mockResolvedValue({ bytes: 1000, p50: 300 });
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock'], ENV, deps)).toBe(1);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining(KEY));
  });

  it('SHOULD re-measure a suspected regression once and keep the better p50', async () => {
    (measureRoute as jest.Mock)
      .mockResolvedValueOnce({ bytes: 1000, p50: 300 })
      .mockResolvedValueOnce({ bytes: 1000, p50: 105 });
    expect(await checkMain(['--module', 'stock'], ENV, makeDeps().deps)).toBe(0);
    expect(measureRoute).toHaveBeenCalledTimes(2);
  });

  it('SHOULD still fail WHEN the slowdown repeats', async () => {
    (measureRoute as jest.Mock).mockResolvedValue({ bytes: 1000, p50: 300 });
    expect(await checkMain(['--module', 'stock'], ENV, makeDeps().deps)).toBe(1);
  });

  it('SHOULD pass WHEN the baseline is null', async () => {
    registryWith({ p50Ms: null });
    (measureRoute as jest.Mock).mockResolvedValue({ bytes: 1000, p50: 900 });
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock'], ENV, deps)).toBe(0);
  });

  it('SHOULD fail a list over 256 KB without exception and pass with one', async () => {
    (measureRoute as jest.Mock).mockResolvedValue({ bytes: 300000, p50: 100 });
    registryWith({ maxBytes: 300000 });
    const first = makeDeps();
    expect(await checkMain(['--module', 'stock'], ENV, first.deps)).toBe(1);
    expect(first.deps.log).toHaveBeenCalledWith(expect.stringContaining('300000'));

    registryWith({ knownException: 'spec 078', maxBytes: 300000 });
    expect(await checkMain(['--module', 'stock'], ENV, makeDeps().deps)).toBe(0);
  });

  it('SHOULD fail WHEN the concurrent wall time regresses', async () => {
    (loadConcurrency as jest.Mock).mockReturnValue({
      stock: { calls: [KEY], maxPoolWaiting: null, repeat: 3, wallMs: 100 },
    });
    (measureConcurrent as jest.Mock).mockResolvedValue({ wallMs: 400 });
    expect(await checkMain(['--module', 'stock'], ENV, makeDeps().deps)).toBe(1);
  });

  it('SHOULD fail WHEN the pool waiting regresses AND skip it WHEN the baseline is null', async () => {
    (loadConcurrency as jest.Mock).mockReturnValue({
      stock: { calls: [KEY], maxPoolWaiting: 2, repeat: 3, wallMs: null },
    });
    (measureConcurrent as jest.Mock).mockResolvedValue({ maxPoolWaiting: 9, wallMs: 10 });
    const failing = makeDeps();
    expect(await checkMain(['--module', 'stock'], ENV, failing.deps)).toBe(1);
    expect(failing.deps.log).toHaveBeenCalledWith(expect.stringContaining('pool waiting 9'));

    (loadConcurrency as jest.Mock).mockReturnValue({
      stock: { calls: [KEY], maxPoolWaiting: null, repeat: 3, wallMs: null },
    });
    expect(await checkMain(['--module', 'stock'], ENV, makeDeps().deps)).toBe(0);
  });

  it('SHOULD NOT report a pool waiting of 0 WHEN the API sends no header, even after a retry', async () => {
    (loadConcurrency as jest.Mock).mockReturnValue({
      stock: { calls: [KEY], maxPoolWaiting: 0, repeat: 3, wallMs: 100 },
    });
    (measureConcurrent as jest.Mock).mockResolvedValue({ wallMs: 400 });
    const { deps } = makeDeps();

    await checkMain(['--module', 'stock'], ENV, deps);

    expect(deps.log).not.toHaveBeenCalledWith(expect.stringContaining('pool waiting'));
  });

  it('SHOULD store the median pool waiting WHEN --update-baseline', async () => {
    (loadConcurrency as jest.Mock).mockReturnValue({
      stock: { calls: [KEY], maxPoolWaiting: null, repeat: 3, wallMs: null },
    });
    (measureConcurrent as jest.Mock).mockResolvedValue({ maxPoolWaiting: 3, wallMs: 10 });
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock', '--update-baseline'], ENV, deps)).toBe(0);
    expect(deps.applyWall).toHaveBeenCalledWith('stock', 10, 3);
  });

  it('SHOULD fail WHEN EXPLAIN reports a violation', async () => {
    registryWith({ indexes: ['idx'], table: 't' });
    const { deps } = makeDeps({
      explain: jest.fn(async () => [{ key: KEY, violations: ['Seq Scan on t'] }]),
    });
    expect(await checkMain(['--module', 'stock'], ENV, deps)).toBe(1);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Seq Scan on t'));
  });

  it('SHOULD write baselines and exit 0 WHEN --update-baseline', async () => {
    (measureRoute as jest.Mock).mockResolvedValue({ bytes: 1000, p50: 300 });
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock', '--update-baseline'], ENV, deps)).toBe(0);
    expect(deps.applyBaseline).toHaveBeenCalledWith('stock', {
      [KEY]: { maxBytes: 1100, p50Ms: 300 },
    });
  });

  it('SHOULD skip a route whose fixture is missing instead of aborting', async () => {
    registryWith({ params: { id: 'plan' } });
    (loadRegistry as jest.Mock).mockReturnValue({
      stock: { 'GET /api/v1/stock/items/:id': { ...entry, params: { id: 'plan' } } },
    });
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock'], ENV, deps)).toBe(0);
    expect(measureRoute).not.toHaveBeenCalled();
    expect(deps.writeSummary).toHaveBeenCalledWith(expect.stringContaining('skipped'));
  });

  it('SHOULD store the median of 5 rounds WHEN --update-baseline', async () => {
    for (const p50 of [100, 900, 120, 110, 130]) {
      (measureRoute as jest.Mock).mockResolvedValueOnce({ bytes: 1000, p50 });
    }
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock', '--update-baseline'], ENV, deps)).toBe(0);
    expect(measureRoute).toHaveBeenCalledTimes(5);
    expect(deps.applyBaseline).toHaveBeenCalledWith('stock', {
      [KEY]: { maxBytes: 1100, p50Ms: 120 },
    });
  });

  it('SHOULD measure once WHEN not updating the baseline', async () => {
    await checkMain(['--module', 'stock'], ENV, makeDeps().deps);
    expect(measureRoute).toHaveBeenCalledTimes(1);
  });

  it('SHOULD fail that route but keep measuring WHEN one call returns non-2xx', async () => {
    (measureRoute as jest.Mock).mockRejectedValueOnce(new Error(`${KEY} -> 400`));
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'stock', '--update-baseline'], ENV, deps)).toBe(1);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining(`${KEY} -> 400`));
  });

  it('SHOULD print usage and exit 2 WHEN the module is unknown', async () => {
    const { deps } = makeDeps();
    expect(await checkMain(['--module', 'nope'], ENV, deps)).toBe(2);
  });
});

describe('applyCheckBaseline', () => {
  it('SHOULD rewrite only p50Ms and maxBytes and keep a trailing newline', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'perf-check-')), 'm.json');
    writeFileSync(file, JSON.stringify({ a: { maxQueries: 3, maxBytes: null, p50Ms: null } }));
    applyCheckBaseline(file, { a: { maxBytes: 10, p50Ms: 5 } });
    const text = readFileSync(file, 'utf8');
    expect(JSON.parse(text)).toEqual({ a: { maxBytes: 10, maxQueries: 3, p50Ms: 5 } });
    expect(text.endsWith('\n')).toBe(true);
  });
});
