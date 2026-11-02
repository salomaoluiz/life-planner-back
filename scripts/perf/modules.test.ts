import { moduleForPath, PERF_MODULES, selectModules } from './modules';

describe('moduleForPath', () => {
  it.each([
    ['src/modules/stock/x.ts', 'stock'],
    ['src/api/stock/v1/a.ts', 'stock'],
    ['src/modules/family/domain/a.ts', 'family'],
    ['src/api/family-member/v1/a.ts', 'family'],
    ['src/api/family/v1/a.ts', 'family'],
    ['src/api/auth/v1/a.ts', 'user'],
    ['src/modules/user/a.ts', 'user'],
    ['src/api/user/v1/a.ts', 'user'],
    ['src/api/health/a.ts', 'health'],
    ['src/modules/version/a.ts', 'version'],
    ['src/api/version/v1/a.ts', 'version'],
    ['src/modules/finance/a.ts', 'finance'],
    ['src/shared/infra/db/Database.ts', 'all'],
    ['prisma/schema.prisma', 'all'],
    ['package.json', 'all'],
    ['yarn.lock', 'all'],
    ['README.md', null],
    ['docs/x.md', null],
    ['scripts/perf/x.ts', null],
    ['perf/budgets/stock.json', null],
  ])('SHOULD map %s to %s', (file, expected) => {
    expect(moduleForPath(file)).toBe(expected);
  });
});

describe('selectModules', () => {
  it('SHOULD select nothing WHEN there are no files', () => {
    expect(selectModules([])).toEqual([]);
  });

  it('SHOULD select only the touched modules, sorted and without duplicates', () => {
    expect(selectModules(['src/modules/stock/a.ts', 'src/api/stock/v1/b.ts', 'README.md'])).toEqual(
      ['stock'],
    );
    expect(selectModules(['src/modules/stock/a.ts', 'src/api/auth/a.ts'])).toEqual([
      'stock',
      'user',
    ]);
  });

  it('SHOULD select every module WHEN a shared file changed', () => {
    expect(selectModules(['src/shared/infra/db/Database.ts', 'README.md'])).toEqual(PERF_MODULES);
  });
});
