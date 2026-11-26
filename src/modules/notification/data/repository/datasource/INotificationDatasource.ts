import {
  Notification,
  NotificationDelivery,
  NotificationDevice,
  NotificationItem,
  Prisma,
} from '@db/client';

export type DeliveryWithContext = {
  device: NotificationDevice;
  notification: { items: NotificationItem[] } & Notification;
} & NotificationDelivery;
export interface DeliveryWrite {
  attempts?: number;
  error?: null | string;
  id: string;
  next_attempt_at?: Date;
  sent_at?: Date;
  status: NotificationDelivery['status'];
  ticket_id?: null | string;
}
export interface INotificationDatasource {
  cleanup(
    noticeCutoff: Date,
    deliveryCutoff: Date,
  ): Promise<{ deliveries: number; notices: number }>;
  create(write: NoticeWrite): Promise<NotificationWithItems>;
  deleteByUser(userId: string): Promise<number>;
  findKeys(userId: string, localDate: string): Promise<string[]>;
  findPage(query: {
    cursor?: { createdAt: Date; id: string };
    limit: number;
    module?: NotificationItem['module'];
    unread?: boolean;
    userId: string;
  }): Promise<NotificationWithItems[]>;
  findPendingDeliveries(now: Date, limit: number): Promise<DeliveryWithContext[]>;
  findSentTickets(olderThan: Date, newerThan: Date, limit: number): Promise<NotificationDelivery[]>;
  getUnreadStats(
    userId: string,
  ): Promise<{ count: number; last_created_at: Date | null; last_read_at: Date | null }>;
  markAllRead(userId: string, before: Date, now: Date): Promise<void>;
  markRead(userId: string, id: string, now: Date): Promise<number>;
  removeFamilyItems(userId: string | undefined, familyId: string): Promise<void>;
  updateDeliveries(updates: DeliveryWrite[]): Promise<void>;
}
export interface NoticeItemWrite {
  dedupe_key: string;
  due_date: Date;
  module: NotificationItem['module'];
  owner: NotificationItem['owner'];
  owner_id: string;
  position: number;
  route: string;
  snapshot: Prisma.InputJsonValue;
  source_id: string;
  state: NotificationItem['state'];
  type: NotificationItem['type'];
}
export interface NoticeWrite {
  body: string;
  items: NoticeItemWrite[];
  kind: Notification['kind'];
  local_date: string;
  push_at: Date;
  summary_done: boolean;
  title: string;
  user_id: string;
}
export type NotificationWithItems = { items: NotificationItem[] } & Notification;
