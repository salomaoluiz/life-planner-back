import { Injectable } from '@nestjs/common';

import { NotificationPreference, Prisma } from '@db/client';
import {
  INotificationPreferenceDatasource,
  PreferenceWrite,
} from '@notification/data/repository/datasource/INotificationPreferenceDatasource';
import { Database } from '@shared/infra/db/Database';

function DAY(localDate: string) {
  return new Date(`${localDate}T00:00:00.000Z`);
}

@Injectable()
export class NotificationPreferenceDatasource implements INotificationPreferenceDatasource {
  constructor(private readonly db: Database) {}

  async deleteFamily(userId: string, familyId: string): Promise<void> {
    await this.db.client.notificationFamilyPreference.deleteMany({
      where: { family_id: familyId, user_id: userId },
    });
  }

  async find(userId: string): Promise<NotificationPreference | null> {
    return this.db.client.notificationPreference.findUnique({ where: { user_id: userId } });
  }

  async findDisabledFamilies(userIds: string[]): Promise<{ family_id: string; user_id: string }[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.db.client.notificationFamilyPreference.findMany({
      select: { family_id: true, user_id: true },
      where: { enabled: false, user_id: { in: userIds } },
    });
  }

  // Spec 124 FR 9, 14 and section 11: only users whose local time reached the summary time (summary still owed, not in
  // the last minute of the day) or whose summary of the local date exists (urgent). Users without a row use the defaults.
  async findDue(
    now: Date,
    afterUserId: string | undefined,
    limit: number,
  ): Promise<NotificationPreference[]> {
    return this.db.client.$queryRaw<NotificationPreference[]>(Prisma.sql`
      SELECT u."id" AS "user_id",
        COALESCE(p."disabled_types", ARRAY[]::"NotificationType"[]) AS "disabled_types",
        COALESCE(p."bill_lead_days", 3) AS "bill_lead_days",
        COALESCE(p."invoice_lead_days", 3) AS "invoice_lead_days",
        COALESCE(p."summary_minute", 480) AS "summary_minute",
        COALESCE(p."quiet_start_minute", 1320) AS "quiet_start_minute",
        COALESCE(p."quiet_end_minute", 420) AS "quiet_end_minute",
        COALESCE(p."time_zone", 'America/Sao_Paulo') AS "time_zone",
        COALESCE(p."locale", 'pt-BR') AS "locale",
        p."last_summary_on" AS "last_summary_on",
        COALESCE(p."created_at", u."created_at", now()) AS "created_at",
        COALESCE(p."updated_at", now()) AS "updated_at"
      FROM "User" u
      LEFT JOIN "notification_preferences" p ON p."user_id" = u."id"
      CROSS JOIN LATERAL (
        SELECT (${now}::timestamptz AT TIME ZONE COALESCE(p."time_zone", 'America/Sao_Paulo')) AS "local"
      ) l
      WHERE (${afterUserId ?? null}::text IS NULL OR u."id" > ${afterUserId ?? null}::text)
        AND (
          (
            EXTRACT(HOUR FROM l."local") * 60 + EXTRACT(MINUTE FROM l."local") >= COALESCE(p."summary_minute", 480)
            AND EXTRACT(HOUR FROM l."local") * 60 + EXTRACT(MINUTE FROM l."local") <= 1438
            AND (p."last_summary_on" IS NULL OR p."last_summary_on" < l."local"::date)
          )
          OR p."last_summary_on" = l."local"::date
        )
      ORDER BY u."id"
      LIMIT ${limit}
    `);
  }

  async setFamily(userId: string, familyId: string, enabled: boolean): Promise<void> {
    await this.db.client.notificationFamilyPreference.upsert({
      create: { enabled, family_id: familyId, user_id: userId },
      update: { enabled },
      where: { user_id_family_id: { family_id: familyId, user_id: userId } },
    });
  }

  async setLastSummaryOn(userId: string, localDate: string): Promise<void> {
    await this.db.client.notificationPreference.upsert({
      create: { last_summary_on: DAY(localDate), user_id: userId },
      update: { last_summary_on: DAY(localDate) },
      where: { user_id: userId },
    });
  }

  async upsert(userId: string, data: PreferenceWrite): Promise<NotificationPreference> {
    return this.db.client.notificationPreference.upsert({
      create: { ...data, user_id: userId },
      update: data,
      where: { user_id: userId },
    });
  }
}
