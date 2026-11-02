const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

export class SeedRefusal extends Error {
  readonly exitCode = 2;
}

export function resolveApiUrl(env: NodeJS.ProcessEnv): string {
  return env.PERF_API_URL || `http://localhost:${env.PORT || 3000}`;
}

export function assertSeedAllowed(env: NodeJS.ProcessEnv, apiUrl: string): void {
  if (env.PERF_SEED_ALLOW !== 'staging') {
    throw new SeedRefusal('perf seed refused: set PERF_SEED_ALLOW=staging');
  }
  if (env.NODE_ENV === 'production') {
    throw new SeedRefusal('perf seed refused: NODE_ENV is production');
  }
  let hostname: string;
  try {
    hostname = new URL(apiUrl).hostname;
  } catch {
    throw new SeedRefusal('perf seed refused: the API url is not valid');
  }
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new SeedRefusal('perf seed refused: the API host must be localhost or 127.0.0.1');
  }
}
