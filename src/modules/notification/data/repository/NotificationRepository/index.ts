import { Inject, Injectable } from '@nestjs/common';

import { Prisma } from '@db/client';
import { NotificationMapper } from '@notification/data/datasource/mapper/NotificationMapper';
import { INotificationDatasource } from '@notification/data/repository/datasource/INotificationDatasource';
import {
  DeliveryUpdate,
  NewNotification,
  NotificationEntity,
  PendingDelivery,
  SentTicket,
  UnreadStats,
} from '@notification/domain/entity/NotificationEntity';
import { INotificationRepository, NoticePageQuery } from '@notification/domain/repository';

@Injectable()
export class NotificationRepository implements INotificationRepository {
  constructor(
    @Inject('INotificationDatasource') private readonly datasource: INotificationDatasource,
  ) {}

  async cleanup(
    noticeCutoff: Date,
    deliveryCutoff: Date,
  ): Promise<{ deliveries: number; notices: number }> {
    return this.datasource.cleanup(noticeCutoff, deliveryCutoff);
  }

  async create(notice: NewNotification, summaryDone: boolean): Promise<NotificationEntity> {
    const row = await this.datasource.create({
      body: notice.body,
      items: notice.items.map((item) => ({
        dedupe_key: item.dedupeKey,
        due_date: new Date(`${item.dueDate}T00:00:00.000Z`),
        module: item.module,
        owner: item.owner,
        owner_id: item.ownerId,
        position: item.position,
        route: item.route,
        snapshot: item.snapshot as unknown as Prisma.InputJsonValue,
        source_id: item.sourceId,
        state: item.state,
        type: item.type,
      })),
      kind: notice.kind,
      local_date: notice.localDate,
      push_at: notice.pushAt,
      summary_done: summaryDone,
      title: notice.title,
      user_id: notice.userId,
    });

    return NotificationMapper.toNotification(row);
  }

  async deleteByUser(userId: string): Promise<number> {
    return this.datasource.deleteByUser(userId);
  }

  async findKeys(userId: string, localDate: string): Promise<Set<string>> {
    return new Set(await this.datasource.findKeys(userId, localDate));
  }

  async findPage(query: NoticePageQuery): Promise<NotificationEntity[]> {
    const rows = await this.datasource.findPage(query);

    return rows.map((row) => NotificationMapper.toNotification(row));
  }

  async findPendingDeliveries(now: Date, limit: number): Promise<PendingDelivery[]> {
    const rows = await this.datasource.findPendingDeliveries(now, limit);

    return rows.map((row) => NotificationMapper.toPendingDelivery(row));
  }

  async findSentTickets(olderThan: Date, newerThan: Date, limit: number): Promise<SentTicket[]> {
    const rows = await this.datasource.findSentTickets(olderThan, newerThan, limit);

    return rows.map((row) => ({
      deliveryId: row.id,
      deviceId: row.device_id,
      ticketId: row.ticket_id as string,
    }));
  }

  async getUnreadStats(userId: string): Promise<UnreadStats> {
    const stats = await this.datasource.getUnreadStats(userId);

    return {
      count: stats.count,
      lastCreatedAt: stats.last_created_at,
      lastReadAt: stats.last_read_at,
    };
  }

  async markAllRead(userId: string, before: Date, now: Date): Promise<void> {
    await this.datasource.markAllRead(userId, before, now);
  }

  async markRead(userId: string, id: string, now: Date): Promise<boolean> {
    return (await this.datasource.markRead(userId, id, now)) > 0;
  }

  async removeFamilyItems(userId: string, familyId: string): Promise<void> {
    await this.datasource.removeFamilyItems(userId, familyId);
  }

  async removeFamilyItemsForAll(familyId: string): Promise<void> {
    await this.datasource.removeFamilyItems(undefined, familyId);
  }

  async updateDeliveries(updates: DeliveryUpdate[]): Promise<void> {
    await this.datasource.updateDeliveries(
      updates.map((update) => ({
        attempts: update.attempts,
        error: update.error,
        id: update.id,
        next_attempt_at: update.nextAttemptAt,
        sent_at: update.sentAt,
        status: update.status,
        ticket_id: update.ticketId,
      })),
    );
  }
}
