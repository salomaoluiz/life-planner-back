import { readFileSync } from 'node:fs';

import { z } from 'zod';

const scenarioSchema = z.object({
  calls: z.array(z.string().min(1)).min(1),
  maxPoolWaiting: z.number().int().nonnegative().nullable(),
  repeat: z.number().int().positive(),
  wallMs: z.number().nonnegative().nullable(),
});

export type ConcurrencyScenario = z.infer<typeof scenarioSchema>;

export function loadConcurrency(file: string): Record<string, ConcurrencyScenario> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`perf concurrency: cannot read ${file}`);
  }
  const parsed = z.record(z.string(), scenarioSchema).safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `perf concurrency: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    );
  }

  return parsed.data;
}
