import { Injectable } from '@nestjs/common';

import { Prisma } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import { IAiUsageDatasource } from '@stock/data/repository/datasource/IAiUsageDatasource';

const RETENTION_DAYS = 30;

@Injectable()
export class AiUsageDatasource implements IAiUsageDatasource {
  constructor(private readonly db: Database) {}

  // One atomic statement: no row returned means the limit was reached. The first call of a day also drops
  // the user's rows older than 30 days (no cron).
  async consume(
    user_id: string,
    kind: 'LIGHT' | 'SEARCH',
    day: string,
    limit: number,
  ): Promise<null | number> {
    const rows = await this.db.client.$queryRaw<{ count: number }[]>(Prisma.sql`
      INSERT INTO "ai_usage_daily" ("user_id", "day", "kind", "count", "updated_at")
      SELECT ${user_id}, ${day}::date, ${kind}::"AiUsageKind", 1, now() WHERE ${limit}::int > 0
      ON CONFLICT ("user_id", "day", "kind")
      DO UPDATE SET "count" = "ai_usage_daily"."count" + 1, "updated_at" = now()
      WHERE "ai_usage_daily"."count" < ${limit}::int
      RETURNING "count"
    `);
    const count = rows[0]?.count ?? null;

    if (count === 1) {
      await this.db.client.$executeRaw(Prisma.sql`
        DELETE FROM "ai_usage_daily"
        WHERE "user_id" = ${user_id} AND "day" < ${day}::date - ${RETENTION_DAYS}::int
      `);
    }

    return count;
  }

  async findDay(
    user_id: string,
    day: string,
  ): Promise<{ count: number; kind: 'LIGHT' | 'SEARCH' }[]> {
    return this.db.client.aiUsageDaily.findMany({
      select: { count: true, kind: true },
      where: { day: new Date(`${day}T00:00:00.000Z`), user_id },
    });
  }
}
