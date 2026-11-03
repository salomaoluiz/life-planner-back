import { Client, Pool } from 'pg';

export interface QueryCount {
  control: number;
  statements: string[];
  total: number;
  values: unknown[][];
}

type QueryFn = (...args: unknown[]) => unknown;

const CONTROL = /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;

// Opt-in (PERF_COUNT_QUERIES=1): counts the statements that reach Postgres between begin() and end().
// Not enabled, nothing is patched.
export class QueryCounter {
  private static maxWaiting = 0;
  private static original?: Client['query'];
  private static originalConnect?: Pool['connect'];
  private static recording?: string[];
  private static recordingValues?: unknown[][];

  static begin(): void {
    QueryCounter.recording = [];
    QueryCounter.recordingValues = [];
  }

  static disable(): void {
    if (QueryCounter.original) {
      Client.prototype.query = QueryCounter.original;
      QueryCounter.original = undefined;
    }
    if (QueryCounter.originalConnect) {
      Pool.prototype.connect = QueryCounter.originalConnect;
      QueryCounter.originalConnect = undefined;
    }
    QueryCounter.maxWaiting = 0;
    QueryCounter.recording = undefined;
    QueryCounter.recordingValues = undefined;
  }

  static enable(): void {
    if (QueryCounter.original) return;
    const original = Client.prototype.query;
    QueryCounter.original = original;
    Client.prototype.query = function patched(this: Client, ...args: unknown[]) {
      QueryCounter.record(args[0], args[1]);

      return (original as unknown as QueryFn).apply(this, args);
    } as unknown as Client['query'];

    // Pool pressure (spec 069): the most connection requests that waited at once. `pool.query` goes through `connect`.
    const originalConnect = Pool.prototype.connect;
    QueryCounter.originalConnect = originalConnect;
    Pool.prototype.connect = function patched(this: Pool, ...args: unknown[]) {
      const result = (originalConnect as unknown as QueryFn).apply(this, args);
      QueryCounter.maxWaiting = Math.max(QueryCounter.maxWaiting, this.waitingCount);

      return result;
    } as unknown as Pool['connect'];
  }

  static end(): QueryCount {
    const statements = QueryCounter.recording ?? [];
    const values = QueryCounter.recordingValues ?? [];
    QueryCounter.recording = undefined;
    QueryCounter.recordingValues = undefined;

    return {
      control: statements.filter((sql) => CONTROL.test(sql)).length,
      statements,
      total: statements.length,
      values,
    };
  }

  static isEnabled(): boolean {
    return QueryCounter.original !== undefined;
  }

  static poolMaxWaiting(): number {
    return QueryCounter.maxWaiting;
  }

  private static record(first: unknown, second: unknown): void {
    if (!QueryCounter.recording) return;
    const config =
      typeof first === 'string' ? undefined : (first as { text?: string; values?: unknown[] });
    QueryCounter.recording.push(typeof first === 'string' ? first : (config?.text ?? ''));
    const bound = Array.isArray(second) ? second : config?.values;
    QueryCounter.recordingValues?.push(Array.isArray(bound) ? bound : []);
  }

  static resetPool(): void {
    QueryCounter.maxWaiting = 0;
  }
}
