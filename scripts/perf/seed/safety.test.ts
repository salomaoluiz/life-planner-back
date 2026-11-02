import { assertSeedAllowed, resolveApiUrl, SeedRefusal } from './safety';

const allowed = { NODE_ENV: 'development', PERF_SEED_ALLOW: 'staging' };

describe('assertSeedAllowed', () => {
  it('passes for a local url with the allow flag', () => {
    expect(() => assertSeedAllowed(allowed, 'http://localhost:3000')).not.toThrow();
    expect(() => assertSeedAllowed(allowed, 'http://127.0.0.1:3000')).not.toThrow();
  });

  it('refuses without PERF_SEED_ALLOW=staging', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'development' }, 'http://localhost:3000')).toThrow(
      SeedRefusal,
    );
  });

  it('refuses in production', () => {
    expect(() =>
      assertSeedAllowed({ ...allowed, NODE_ENV: 'production' }, 'http://localhost:3000'),
    ).toThrow(SeedRefusal);
  });

  it.each([
    'https://api.example.com',
    'http://localhost.evil.com:3000',
    'http://127.0.0.1.evil.com',
    'not a url',
    '',
  ])('refuses the host of %p', (url) => {
    expect(() => assertSeedAllowed(allowed, url)).toThrow(SeedRefusal);
  });

  it('exposes exit code 2', () => {
    expect(new SeedRefusal('x').exitCode).toBe(2);
  });
});

describe('resolveApiUrl', () => {
  it('prefers PERF_API_URL', () => {
    expect(resolveApiUrl({ PERF_API_URL: 'http://localhost:1', PORT: '3' })).toBe(
      'http://localhost:1',
    );
  });

  it('falls back to localhost with PORT, then 3000', () => {
    expect(resolveApiUrl({ PORT: '1009' })).toBe('http://localhost:1009');
    expect(resolveApiUrl({})).toBe('http://localhost:3000');
  });
});
