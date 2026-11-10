export type PerfModule =
  | 'family'
  | 'finance'
  | 'health'
  | 'investment'
  | 'stock'
  | 'user'
  | 'version';

export const PERF_MODULES: PerfModule[] = [
  'family',
  'finance',
  'health',
  'investment',
  'stock',
  'user',
  'version',
];

// Folder name (under src/modules and src/api) -> perf module.
const FOLDER_TO_MODULE: Record<string, PerfModule> = {
  auth: 'user',
  family: 'family',
  'family-member': 'family',
  finance: 'finance',
  health: 'health',
  investment: 'investment',
  stock: 'stock',
  user: 'user',
  version: 'version',
};

const SHARED = /^(src\/shared\/|prisma\/|package\.json$|yarn\.lock$)/;
const MODULE_PATH = /^src\/(?:modules|api)\/([^/]+)\//;

export function moduleForPath(file: string): 'all' | null | PerfModule {
  if (SHARED.test(file)) return 'all';
  const folder = MODULE_PATH.exec(file)?.[1];

  return (folder && FOLDER_TO_MODULE[folder]) || null;
}

export function selectModules(files: string[]): PerfModule[] {
  const selected = new Set<PerfModule>();
  for (const file of files) {
    const mapped = moduleForPath(file);
    if (mapped === 'all') return [...PERF_MODULES];
    if (mapped) selected.add(mapped);
  }

  return PERF_MODULES.filter((name) => selected.has(name));
}
