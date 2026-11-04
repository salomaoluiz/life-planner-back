import { QueryCounter } from '@shared/infra/db/QueryCounter';

export interface Measured {
  inTx: number;
  statements: string[];
  total: number;
}

// Statements strictly between the first BEGIN and the COMMIT that closes it, for one request.
export async function measure<T>(run: () => Promise<T>): Promise<Measured & { result: T }> {
  QueryCounter.begin();
  const result = await run();
  const { statements, total } = QueryCounter.end();
  const begin = statements.findIndex((sql) => /^\s*BEGIN\b/i.test(sql));
  const commit = statements.findIndex((sql, index) => index > begin && /^\s*COMMIT\b/i.test(sql));

  const inside = begin < 0 || commit < 0 ? [] : statements.slice(begin + 1, commit);

  return { inTx: begin < 0 || commit < 0 ? -1 : inside.length, result, statements: inside, total };
}
