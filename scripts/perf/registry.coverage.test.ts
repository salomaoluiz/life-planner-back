import { join } from 'node:path';

import { moduleForPath, PERF_MODULES, PerfModule } from './modules';
import { loadRegistry, parseRegistryKey } from './registry';
import { listRoutes } from './routes';

const BUDGETS = join(__dirname, '../../perf/budgets');
const routes = listRoutes();
const registry = loadRegistry(BUDGETS);

function ownerOf(file: string): PerfModule {
  const owner = moduleForPath(file);
  if (owner === null || owner === 'all') throw new Error(`no perf module owns ${file}`);

  return owner;
}

describe('perf budgets registry', () => {
  it('SHOULD have a registry entry for every controller route', () => {
    const missing = routes
      .filter((route) => {
        const owner = ownerOf(route.file);

        return !Object.keys(registry[owner]).some((key) => {
          const parsed = parseRegistryKey(key);

          return parsed.method === route.method && parsed.template === route.template;
        });
      })
      .map(
        (route) =>
          `Add "${route.method} ${route.template}" to perf/budgets/${ownerOf(route.file)}.json (see .claude/context/testing.md)`,
      );

    expect(missing).toEqual([]);
  });

  it('SHOULD have no registry entry whose route no longer exists', () => {
    const existing = new Set(routes.map((route) => `${route.method} ${route.template}`));
    const stale = PERF_MODULES.flatMap((name) =>
      Object.keys(registry[name])
        .filter((key) => {
          const parsed = parseRegistryKey(key);

          return !existing.has(`${parsed.method} ${parsed.template}`);
        })
        .map((key) => `Remove "${key}" from perf/budgets/${name}.json: the route no longer exists`),
    );

    expect(stale).toEqual([]);
  });

  it('SHOULD keep each entry in the module that owns its controller', () => {
    const owners = new Map(routes.map((r) => [`${r.method} ${r.template}`, ownerOf(r.file)]));
    const misplaced = PERF_MODULES.flatMap((name) =>
      Object.keys(registry[name])
        .filter((key) => {
          const parsed = parseRegistryKey(key);

          return owners.get(`${parsed.method} ${parsed.template}`) !== name;
        })
        .map((key) => `"${key}" is in perf/budgets/${name}.json but belongs to another module`),
    );

    expect(misplaced).toEqual([]);
  });
});
