import type { SeedManifest } from '../seed/manifest';
import { SeedRefusal } from '../seed/safety';
import type { PerfModule } from '../modules';

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

export type ManifestStatus = 'missing' | 'ok' | 'stale';
export type SeedModuleName = 'family' | 'finance' | 'stock';

// Same gate as the seed (spec 064): staging opt-in, never production, local database.
export function assertPerfRunAllowed(env: NodeJS.ProcessEnv): void {
  if (env.PERF_SEED_ALLOW !== 'staging') {
    throw new SeedRefusal('perf run refused: set PERF_SEED_ALLOW=staging');
  }
  if (env.NODE_ENV === 'production' || env.APP_ENVIRONMENT === 'production') {
    throw new SeedRefusal('perf run refused: the environment is production');
  }
  // A remote staging database needs an explicit opt-in naming that exact host (production is still refused above).
  const allowed =
    env.DB_HOST !== undefined &&
    (LOCAL_HOSTS.includes(env.DB_HOST) || env.PERF_DB_HOST_ALLOW === env.DB_HOST);
  if (!allowed) {
    throw new SeedRefusal(
      'perf run refused: DB_HOST must be localhost, 127.0.0.1 or equal to PERF_DB_HOST_ALLOW',
    );
  }
}

export function manifestStatus(
  manifest: SeedManifest | undefined,
  configHash: string,
  module: PerfModule,
): ManifestStatus {
  if (!manifest) return 'missing';
  const counts = manifest.counts;
  const seeded =
    (module === 'finance' && (counts.transactions ?? 0) > 0) ||
    (module === 'family' && (counts.families ?? 0) > 0) ||
    (module === 'stock' && 'stockCreated' in counts) ||
    seedModuleFor(module) === undefined;
  if (!seeded) return 'missing';

  return manifest.configHash === configHash ? 'ok' : 'stale';
}

export function seedModuleFor(module: PerfModule): SeedModuleName | undefined {
  return module === 'finance' || module === 'stock' || module === 'family' ? module : undefined;
}
