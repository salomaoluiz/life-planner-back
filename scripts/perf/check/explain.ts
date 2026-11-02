import { Client } from 'pg';

import { QueryCounter } from '@shared/infra/db/QueryCounter';

import { inspectPlan } from './plan';

export interface ExplainEntry {
  indexes: string[];
  key: string;
  path: string;
  seqScanException?: string;
  table: string;
}

// Runs inside the process that has PERF_COUNT_QUERIES=1: calls each read route, keeps the statements
// that touch the entry's table and EXPLAINs them with their bind values. Plain EXPLAIN, never ANALYZE.
export async function runExplain(args: {
  baseUrl: string;
  entries: ExplainEntry[];
  fetchFn?: typeof fetch;
  token: string;
}): Promise<{ key: string; violations: string[] }[]> {
  const fetchFn = args.fetchFn ?? fetch;
  const client = new Client({
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
  });
  await client.connect();
  try {
    const results: { key: string; violations: string[] }[] = [];
    for (const entry of args.entries) {
      QueryCounter.begin();
      const response = await fetchFn(`${args.baseUrl}${entry.path}`, {
        headers: { Authorization: `Bearer ${args.token}` },
      });
      const { statements, values } = QueryCounter.end();
      if (!response.ok) throw new Error(`${entry.key} -> ${response.status}`);

      const violations: string[] = [];
      let indexSatisfied = entry.indexes.length === 0;
      for (const [i, sql] of statements.entries()) {
        if (!/^\s*select\b/i.test(sql) || !sql.includes(`"${entry.table}"`)) continue;
        const explained = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`, values[i]);
        const plan = (explained.rows[0] as Record<string, unknown>)['QUERY PLAN'];
        const found = inspectPlan(plan, { ...entry, indexes: [] });
        violations.push(...found.filter((message) => !violations.includes(message)));
        if (inspectPlan(plan, { ...entry, seqScanException: 'index check only' }).length === 0) {
          indexSatisfied = true;
        }
      }
      if (!indexSatisfied) violations.push(`expected index not used: ${entry.indexes.join(', ')}`);
      results.push({ key: entry.key, violations });
    }

    return results;
  } finally {
    await client.end();
  }
}
