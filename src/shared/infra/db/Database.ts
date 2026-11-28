import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'node:async_hooks';

import { Prisma, PrismaClient } from '@db/client';
import { EnvService } from '@shared/infra/env/env.service';

import { QueryCounter } from './QueryCounter';

// A `$transaction` inside the open one: the callback form gets the open client; the batch form (an array of lazy
// queries) runs them one after the other, in order, like Prisma does.
async function runJoined<T>(
  tx: T,
  arg: ((client: T) => Promise<unknown>) | PromiseLike<unknown>[],
): Promise<unknown> {
  if (Array.isArray(arg)) {
    const results: unknown[] = [];

    for (const query of arg) {
      results.push(await query);
    }

    return results;
  }

  return arg(tx);
}

@Injectable()
export class Database {
  prisma: PrismaClient;
  // Spec 120: a transaction opened by `runInTransaction` that every `client` use inside it joins.
  private readonly ambient = new AsyncLocalStorage<PrismaClient>();

  constructor(private readonly env: EnvService) {
    if (this.env.perfCountQueries) {
      QueryCounter.enable();
    }

    const statementTimeout = this.env.dbStatementTimeoutMs;
    const adapter = new PrismaPg({
      connectionString: `postgresql://${encodeURIComponent(this.env.dbUser)}:${encodeURIComponent(this.env.dbPassword)}@${this.env.dbHost}:${this.env.dbPort}/${this.env.dbName}`,
      // 0 keeps the pg default: wait for a free connection without a limit.
      connectionTimeoutMillis: this.env.dbPoolConnectionTimeoutMs,
      idleTimeoutMillis: this.env.dbPoolIdleTimeoutMs,
      max: this.env.dbPoolMax,
      ...(statementTimeout > 0 ? { statement_timeout: statementTimeout } : {}),
    });

    this.prisma = new PrismaClient({
      adapter,
    });
  }

  get client(): PrismaClient {
    return this.ambient.getStore() ?? this.prisma;
  }

  // Runs `work` in ONE database transaction shared by every datasource it calls (their own
  // `$transaction` blocks join it instead of opening another). Nested calls reuse the open one.
  async runInTransaction<T>(work: () => Promise<T>, timeoutMs = 30_000): Promise<T> {
    if (this.ambient.getStore()) {
      return work();
    }

    return this.prisma.$transaction(
      async (tx) => {
        const scoped = new Proxy(tx, {
          get: (target, property, receiver) =>
            property === '$transaction'
              ? async (arg: ((client: typeof tx) => Promise<unknown>) | PromiseLike<unknown>[]) =>
                  runJoined(tx, arg)
              : Reflect.get(target, property, receiver),
        }) as unknown as PrismaClient;

        return this.ambient.run(scoped, work);
      },
      { maxWait: timeoutMs, timeout: timeoutMs },
    );
  }

  // Spec 124 FR 26: runs `work` only when this instance gets the transaction-level advisory lock `key`; it is released
  // when the transaction ends, even after a crash. `false` = another instance holds it and `work` did not run. The work
  // itself uses the pool, not this transaction (it only holds the lock).
  async withAdvisoryLock(
    key: number,
    work: () => Promise<void>,
    timeoutMs = 300_000,
  ): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<{ locked: boolean }[]>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${key}) AS locked`,
        );

        if (!row?.locked) {
          return false;
        }

        await work();

        return true;
      },
      { maxWait: 5000, timeout: timeoutMs },
    );
  }
}
