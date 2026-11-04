import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { PERF_MODULES, PerfModule } from './modules';

const KEY = /^(GET|POST|PUT|PATCH|DELETE) (\/\S*?)(?: #(\S+))?$/;

const entrySchema = z
  .object({
    indexes: z.array(z.string()).nullable(),
    kind: z.enum(['read', 'unmeasured']),
    knownException: z.string().min(1).optional(),
    maxBytes: z.number().int().nonnegative().nullable(),
    maxQueries: z.number().int().nonnegative(),
    // Spec 085: most statements a write holds between BEGIN and COMMIT (checked by perf/write-transactions.perf.test.ts).
    maxQueriesInTx: z.number().int().positive().optional(),
    p50Ms: z.number().nonnegative().nullable(),
    params: z.record(z.string(), z.string()).optional(),
    reason: z.string().min(1).optional(),
    scenario: z.string(),
    seqScanException: z.string().min(1).optional(),
    table: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.kind === 'unmeasured' && !entry.reason) {
      ctx.addIssue({ code: 'custom', message: 'unmeasured entries need a reason' });
    }
  });

export type BudgetEntry = z.infer<typeof entrySchema>;
export type Registry = Record<PerfModule, Record<string, BudgetEntry>>;

export function loadRegistry(dir: string, modules: PerfModule[] = PERF_MODULES): Registry {
  const registry = {} as Registry;
  for (const name of modules) {
    const file = `${name}.json`;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch {
      throw new Error(`perf registry: cannot read ${file}`);
    }
    registry[name] = {};
    for (const [key, value] of Object.entries(raw)) {
      parseRegistryKey(key);
      const parsed = entrySchema.safeParse(value);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => issue.message).join('; ');
        throw new Error(`perf registry: ${file} "${key}": ${issues}`);
      }
      registry[name][key] = parsed.data;
    }
  }

  return registry;
}

export function parseRegistryKey(key: string): {
  method: string;
  scenario: string | undefined;
  template: string;
} {
  const match = KEY.exec(key);
  if (!match) {
    throw new Error(`perf registry: key "${key}" must look like "METHOD /path[ #scenario]"`);
  }

  return { method: match[1], scenario: match[3], template: match[2] };
}

export function routeKey(method: string, template: string, scenario?: string): string {
  return `${method} ${template}${scenario ? ` #${scenario}` : ''}`;
}
