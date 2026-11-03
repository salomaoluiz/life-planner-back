import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@db/client';
import { EnvService } from '@shared/infra/env/env.service';

import { QueryCounter } from './QueryCounter';

@Injectable()
export class Database {
  prisma: PrismaClient;

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
    return this.prisma;
  }
}
