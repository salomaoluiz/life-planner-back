import { readFileSync, writeFileSync } from 'node:fs';

import { QueryCounter } from '@shared/infra/db/QueryCounter';

export interface MeasureArgs {
  baseUrl: string;
  fetchFn?: typeof fetch;
  key: string;
  onResponse?: (body: unknown) => void;
  request: { body?: unknown; method: string; path: string };
  token: string;
}

// Rewrites only `maxQueries` of the measured keys (the diff in the PR is the evidence).
export function applyBaseline(file: string, measuredByKey: Record<string, number>): void {
  const registry = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { maxQueries: number }>;
  for (const [key, measured] of Object.entries(measuredByKey)) {
    if (registry[key]) registry[key].maxQueries = measured;
  }
  writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`);
}

// Counts the SQL statements of one HTTP call. A GET is called once before to warm it up
// (pool, lazy materialization); a write is called exactly once.
export async function measureRequest(
  args: MeasureArgs,
): Promise<{ measured: number; status: number }> {
  const fetchFn = args.fetchFn ?? fetch;
  const { body, method, path } = args.request;
  const call = () =>
    fetchFn(`${args.baseUrl}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { Authorization: `Bearer ${args.token}`, 'Content-Type': 'application/json' },
      method,
    });

  if (method === 'GET') await call();
  QueryCounter.begin();
  const response = await call();
  const { total } = QueryCounter.end();
  // The body can carry personal data: errors name the key and the status only.
  if (!response.ok) throw new Error(`${args.key} -> ${response.status}`);
  args.onResponse?.(await response.json().catch(() => undefined));

  return { measured: total, status: response.status };
}
