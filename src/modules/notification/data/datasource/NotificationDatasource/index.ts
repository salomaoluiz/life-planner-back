import { Injectable } from '@nestjs/common';

import { NotificationDelivery, Prisma } from '@db/client';
import {
  DeliveryWithContext,
  DeliveryWrite,
  INotificationDatasource,
  NoticeWrite,
  NotificationWithItems,
} from '@notification/data/repository/datasource/INotificationDatasource';
import { Database } from '@shared/infra/db/Database';

function DAY(localDate: string) {
  return new Date(`${localDate}T00:00:00.000Z`);
}
const WITH_ITEMS = { items: { orderBy: { position: 'asc' } } } satisfies Prisma.NotificationInclude;
const FINAL_STATES = ['SENT', 'FAILED', 'INVALID'] as const;

@Injectable()
export class NotificationDatasource implements INotificationDatasource {
  constructor(private readonly db: Database) {}

  async cleanup(
    noticeCutoff: Date,
    deliveryCutoff: Date,
  ): Promise<{ deliveries: number; notices: number }> {
    const deliveries = await this.db.client.notificationDelivery.deleteMany({
      where: { created_at: { lt: deliveryCutoff }, status: { in: [...FINAL_STATES] } },
    });
    const notices = await this.db.client.notification.deleteMany({
      where: { created_at: { lt: noticeCutoff } },
    });

    return { deliveries: deliveries.count, notices: notices.count };
  }

  // FR 10, 27: the notice, its items, one PENDING delivery per enabled device and `last_summary_on`, atomically.
  async create(write: NoticeWrite): Promise<NotificationWithItems> {
    return this.db.client.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          body: write.body,
          kind: write.kind,
          local_date: DAY(write.local_date),
          title: write.title,
          user_id: write.user_id,
        },
      });

      await tx.notificationItem.createMany({
        data: write.items.map((item) => ({
          ...item,
          notification_id: created.id,
          user_id: write.user_id,
        })),
      });

      const notice = {
        ...created,
        items: await tx.notificationItem.findMany({
          orderBy: { position: 'asc' },
          where: { notification_id: created.id },
        }),
      };

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "notification_deliveries" ("id", "notification_id", "device_id", "next_attempt_at")
        SELECT gen_random_uuid()::text, ${notice.id}, d."id", ${write.push_at}
        FROM "notification_devices" d
        WHERE d."user_id" = ${write.user_id} AND d."enabled"
      `);

      if (write.summary_done) {
        await tx.notificationPreference.upsert({
          create: { last_summary_on: DAY(write.local_date), user_id: write.user_id },
          update: { last_summary_on: DAY(write.local_date) },
          where: { user_id: write.user_id },
        });
      }

      return notice;
    });
  }

  async deleteByUser(userId: string): Promise<number> {
    const [notices] = await this.db.client.$transaction([
      this.db.client.notification.deleteMany({ where: { user_id: userId } }),
      this.db.client.notificationDevice.deleteMany({ where: { user_id: userId } }),
      this.db.client.notificationFamilyPreference.deleteMany({ where: { user_id: userId } }),
      this.db.client.notificationPreference.deleteMany({ where: { user_id: userId } }),
    ]);

    return notices.count;
  }

  async findKeys(userId: string, localDate: string): Promise<string[]> {
    const rows = await this.db.client.notificationItem.findMany({
      select: { dedupe_key: true },
      where: { notification: { local_date: DAY(localDate) }, user_id: userId },
    });

    return rows.map((row) => row.dedupe_key);
  }

  async findPage(query: {
    cursor?: { createdAt: Date; id: string };
    limit: number;
    module?: 'FINANCE' | 'STOCK';
    unread?: boolean;
    userId: string;
  }): Promise<NotificationWithItems[]> {
    return this.db.client.notification.findMany({
      include: WITH_ITEMS,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: query.limit,
      where: {
        user_id: query.userId,
        ...(query.unread ? { read_at: null } : {}),
        ...(query.module ? { items: { some: { module: query.module } } } : {}),
        ...(query.cursor
          ? {
              OR: [
                { created_at: { lt: query.cursor.createdAt } },
                { created_at: query.cursor.createdAt, id: { lt: query.cursor.id } },
              ],
            }
          : {}),
      },
    });
  }

  async findPendingDeliveries(now: Date, limit: number): Promise<DeliveryWithContext[]> {
    return this.db.client.notificationDelivery.findMany({
      include: {
        device: true,
        notification: { include: { items: { orderBy: { position: 'asc' }, take: 1 } } },
      },
      orderBy: [{ next_attempt_at: 'asc' }, { id: 'asc' }],
      take: limit,
      where: { device: { enabled: true }, next_attempt_at: { lte: now }, status: 'PENDING' },
    });
  }

  async findSentTickets(
    olderThan: Date,
    newerThan: Date,
    limit: number,
  ): Promise<NotificationDelivery[]> {
    return this.db.client.notificationDelivery.findMany({
      orderBy: { sent_at: 'asc' },
      take: limit,
      where: {
        sent_at: { gt: newerThan, lt: olderThan },
        status: 'SENT',
        ticket_id: { not: null },
      },
    });
  }

  // One indexed statement: the ETag of the bell is built from it (FR 21, section 7).
  async getUnreadStats(
    userId: string,
  ): Promise<{ count: number; last_created_at: Date | null; last_read_at: Date | null }> {
    const [row] = await this.db.client.$queryRaw<
      { count: number; last_created_at: Date | null; last_read_at: Date | null }[]
    >(Prisma.sql`
      SELECT (count(*) FILTER (WHERE "read_at" IS NULL))::int AS "count",
        max("created_at") AS "last_created_at", max("read_at") AS "last_read_at"
      FROM "notifications" WHERE "user_id" = ${userId}
    `);

    return row ?? { count: 0, last_created_at: null, last_read_at: null };
  }

  async markAllRead(userId: string, before: Date, now: Date): Promise<void> {
    await this.db.client.notification.updateMany({
      data: { read_at: now },
      where: { created_at: { lte: before }, read_at: null, user_id: userId },
    });
  }

  // Keeps the first read time; the count tells whether the notice is the user's at all.
  async markRead(userId: string, id: string, now: Date): Promise<number> {
    return this.db.client.$executeRaw(Prisma.sql`
      UPDATE "notifications" SET "read_at" = COALESCE("read_at", ${now})
      WHERE "id" = ${id} AND "user_id" = ${userId}
    `);
  }

  async removeFamilyItems(userId: string | undefined, familyId: string): Promise<void> {
    const owned = userId ? Prisma.sql`AND "user_id" = ${userId}` : Prisma.empty;

    await this.db.client.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "notification_items"
        WHERE "owner" = 'FAMILY' AND "owner_id" = ${familyId} ${owned}
      `);
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "notifications" n
        WHERE NOT EXISTS (SELECT 1 FROM "notification_items" i WHERE i."notification_id" = n."id")
          ${userId ? Prisma.sql`AND n."user_id" = ${userId}` : Prisma.empty}
      `);
    });
  }

  async updateDeliveries(updates: DeliveryWrite[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    await this.db.client.$transaction(async (tx) => {
      for (const { id, ...data } of updates) {
        await tx.notificationDelivery.update({ data, where: { id } });
      }
    });
  }
}
