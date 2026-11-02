import { SeedRefusal } from '../seed/safety';

import { assertPerfRunAllowed, manifestStatus, seedModuleFor } from './safety';

const good = { DB_HOST: 'localhost', NODE_ENV: 'development', PERF_SEED_ALLOW: 'staging' };
const manifest = {
  configHash: 'abc',
  counts: { families: 3, stockCreated: 0, transactions: 10 },
  familyIds: [],
  referenceMonth: '2026-02',
  seededAt: '2026-02-01T00:00:00.000Z',
  userId: 'u',
};

describe('assertPerfRunAllowed', () => {
  it('SHOULD allow a local staging run', () => {
    expect(() => assertPerfRunAllowed(good)).not.toThrow();
    expect(() => assertPerfRunAllowed({ ...good, DB_HOST: '127.0.0.1' })).not.toThrow();
  });

  it.each([
    { ...good, PERF_SEED_ALLOW: undefined },
    { ...good, NODE_ENV: 'production' },
    { ...good, APP_ENVIRONMENT: 'production' },
    { ...good, DB_HOST: 'db.example.com' },
    { ...good, DB_HOST: undefined },
  ])('SHOULD refuse %j', (env) => {
    expect(() => assertPerfRunAllowed(env as NodeJS.ProcessEnv)).toThrow(SeedRefusal);
  });
});

describe('manifestStatus', () => {
  it('SHOULD be missing WHEN there is no manifest or the module key is absent', () => {
    expect(manifestStatus(undefined, 'abc', 'finance')).toBe('missing');
    expect(manifestStatus({ ...manifest, counts: {} }, 'abc', 'finance')).toBe('missing');
    expect(manifestStatus({ ...manifest, counts: {} }, 'abc', 'family')).toBe('missing');
    expect(manifestStatus({ ...manifest, counts: {} }, 'abc', 'stock')).toBe('missing');
  });

  it('SHOULD be stale WHEN the config hash differs', () => {
    expect(manifestStatus(manifest, 'other', 'finance')).toBe('stale');
  });

  it('SHOULD be ok WHEN the module is seeded with the same config', () => {
    expect(manifestStatus(manifest, 'abc', 'finance')).toBe('ok');
    expect(manifestStatus(manifest, 'abc', 'family')).toBe('ok');
    expect(manifestStatus(manifest, 'abc', 'stock')).toBe('ok');
    expect(manifestStatus(manifest, 'abc', 'health')).toBe('ok');
  });
});

describe('seedModuleFor', () => {
  it('SHOULD map seeded modules and ignore the others', () => {
    expect(seedModuleFor('finance')).toBe('finance');
    expect(seedModuleFor('stock')).toBe('stock');
    expect(seedModuleFor('family')).toBe('family');
    expect(seedModuleFor('user')).toBeUndefined();
    expect(seedModuleFor('version')).toBeUndefined();
    expect(seedModuleFor('health')).toBeUndefined();
  });
});
