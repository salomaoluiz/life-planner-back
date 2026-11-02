import { Client } from 'pg';

export interface QueryCount {
  control: number;
  statements: string[];
  total: number;
}

type QueryFn = (...args: unknown[]) => unknown;

const CONTROL = /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;

// Opt-in (PERF_COUNT_QUERIES=1): counts the statements that reach Postgres between begin() and end().
// Not enabled, nothing is patched.
export class QueryCounter {
  private static original?: Client['query'];
  private static recording?: string[];

  static begin(): void {
    QueryCounter.recording = [];
  }

  static disable(): void {
    if (QueryCounter.original) {
      Client.prototype.query = QueryCounter.original;
      QueryCounter.original = undefined;
    }
    QueryCounter.recording = undefined;
  }

  static enable(): void {
    if (QueryCounter.original) return;
    const original = Client.prototype.query;
    QueryCounter.original = original;
    Client.prototype.query = function patched(this: Client, ...args: unknown[]) {
      QueryCounter.record(args[0]);

      return (original as unknown as QueryFn).apply(this, args);
    } as unknown as Client['query'];
  }

  static end(): QueryCount {
    const statements = QueryCounter.recording ?? [];
    QueryCounter.recording = undefined;

    return {
      control: statements.filter((sql) => CONTROL.test(sql)).length,
      statements,
      total: statements.length,
    };
  }

  static isEnabled(): boolean {
    return QueryCounter.original !== undefined;
  }

  private static record(first: unknown): void {
    if (!QueryCounter.recording) return;
    const text = typeof first === 'string' ? first : ((first as { text?: string })?.text ?? '');
    QueryCounter.recording.push(text);
  }
}
