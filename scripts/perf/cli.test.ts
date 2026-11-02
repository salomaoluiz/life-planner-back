import { changedFiles, CliDeps, main, parseCliArgs } from './cli';
import { PERF_MODULES } from './modules';

const manifest = {
  configHash: 'h',
  counts: { families: 3, stockCreated: 0, transactions: 5 },
  familyIds: [],
  referenceMonth: '2026-02',
  seededAt: '2026-02-01T00:00:00.000Z',
  userId: 'u',
};
const goodEnv = { DB_HOST: 'localhost', NODE_ENV: 'development', PERF_SEED_ALLOW: 'staging' };

function deps(overrides: Partial<CliDeps> = {}): CliDeps & { lines: string[] } {
  const lines: string[] = [];

  return {
    changed: () => [],
    configHash: () => 'h',
    lines,
    log: (line) => lines.push(line),
    readManifest: () => manifest,
    runJest: jest.fn().mockReturnValue(0),
    runSeed: jest.fn().mockReturnValue(0),
    summaryVerdict: () => 'PERF PASSED: 1/1',
    ...overrides,
  };
}

describe('parseCliArgs', () => {
  it.each([
    [['--changed'], { all: false, changed: true, dryRun: false, updateBaseline: false }],
    [
      ['--all', '--update-baseline'],
      { all: true, changed: false, dryRun: false, updateBaseline: true },
    ],
    [
      ['--module', 'stock'],
      { all: false, changed: false, dryRun: false, module: 'stock', updateBaseline: false },
    ],
    [
      ['--module=finance', '--dry-run'],
      { all: false, changed: false, dryRun: true, module: 'finance', updateBaseline: false },
    ],
  ])('SHOULD parse %j', (argv, expected) => {
    expect(parseCliArgs(argv)).toEqual(expected);
  });

  it.each([[[]], [['--bogus']], [['--module', 'nope']], [['--all', '--changed']]])(
    'SHOULD reject %j with a usage message',
    (argv) => {
      expect(() => parseCliArgs(argv)).toThrow('usage: yarn perf');
    },
  );
});

describe('changedFiles', () => {
  it('SHOULD join the branch diff, the working tree diff and untracked files without duplicates', () => {
    const run = jest.fn((cmd: string) =>
      cmd.includes('origin/main...HEAD')
        ? 'a.ts\nb.ts\n'
        : cmd.includes('ls-files')
          ? 'c.ts\n'
          : 'b.ts\n',
    );

    expect(changedFiles(run)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });
});

describe('main', () => {
  it('SHOULD select stock and not run anything WHEN --changed --dry-run sees a stock change', async () => {
    const d = deps({ changed: () => ['src/modules/stock/x.ts'] });

    const code = await main(['--changed', '--dry-run'], goodEnv, d);

    expect(code).toBe(0);
    expect(d.lines).toEqual(['perf modules: stock']);
    expect(d.runJest).not.toHaveBeenCalled();
  });

  it('SHOULD select every module WHEN a shared file changed', async () => {
    const d = deps({ changed: () => ['src/shared/infra/db/Database.ts'] });

    await main(['--changed', '--dry-run'], goodEnv, d);

    expect(d.lines).toEqual([`perf modules: ${PERF_MODULES.join(', ')}`]);
  });

  it('SHOULD select nothing and return 0 WHEN only docs changed', async () => {
    const d = deps({ changed: () => ['README.md'] });

    const code = await main(['--changed'], goodEnv, d);

    expect(code).toBe(0);
    expect(d.lines).toEqual(['perf modules: none']);
    expect(d.runJest).not.toHaveBeenCalled();
  });

  it('SHOULD seed once before jest WHEN the manifest is stale', async () => {
    const d = deps({ configHash: () => 'other' });

    const code = await main(['--module', 'finance'], goodEnv, d);

    expect(code).toBe(0);
    expect(d.runSeed).toHaveBeenCalledTimes(1);
    expect(d.runSeed).toHaveBeenCalledWith('finance');
    expect(d.runJest).toHaveBeenCalledWith(expect.objectContaining({ PERF_MODULES: 'finance' }));
  });

  it('SHOULD seed everything WHEN there is no manifest', async () => {
    const d = deps({ readManifest: () => undefined });

    await main(['--module', 'version'], goodEnv, d);

    expect(d.runSeed).toHaveBeenCalledWith(undefined);
  });

  it('SHOULD not seed WHEN the manifest is fine, and pass the baseline flag', async () => {
    const d = deps();

    await main(['--module', 'stock', '--update-baseline'], goodEnv, d);

    expect(d.runSeed).not.toHaveBeenCalled();
    expect(d.runJest).toHaveBeenCalledWith(
      expect.objectContaining({ PERF_MODULES: 'stock', PERF_UPDATE_BASELINE: '1' }),
    );
    expect(d.lines).toContain('PERF PASSED: 1/1');
  });

  it('SHOULD return jest exit code WHEN the budgets fail', async () => {
    const d = deps({ runJest: jest.fn().mockReturnValue(1) });

    expect(await main(['--module', 'stock'], goodEnv, d)).toBe(1);
  });

  it('SHOULD return 2 WHEN the environment is refused', async () => {
    const d = deps();

    const code = await main(['--module', 'stock'], { ...goodEnv, NODE_ENV: 'production' }, d);

    expect(code).toBe(2);
    expect(d.runJest).not.toHaveBeenCalled();
  });

  it('SHOULD return 2 with usage WHEN the arguments are wrong', async () => {
    const d = deps();

    expect(await main(['--bogus'], goodEnv, d)).toBe(2);
    expect(d.lines[0]).toContain('usage: yarn perf');
  });
});
