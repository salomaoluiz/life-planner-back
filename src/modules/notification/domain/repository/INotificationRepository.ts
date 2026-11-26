import {
  DeliveryUpdate,
  NewNotification,
  NotificationEntity,
  PendingDelivery,
  SentTicket,
  UnreadStats,
} from '@notification/domain/entity/NotificationEntity';
import { NotificationModule } from '@notification/domain/enum';

export type INotificationRepository = {
  // Account deletion (section 4): every notice, device and preference of the user. Returns the notices deleted.
  deleteByUser(userId: string): Promise<number>;
  // Retention (FR 28): notices older than `noticeCutoff` (items and deliveries cascade), deliveries in a final state
  // older than `deliveryCutoff`.
  cleanup(
    noticeCutoff: Date,
    deliveryCutoff: Date,
  ): Promise<{ deliveries: number; notices: number }>;
  // One transaction: the notice, its items, one PENDING delivery per enabled device (not before `pushAt`) and, for a
  // summary, `last_summary_on` (FR 10, 27).
  create(notice: NewNotification, summaryDone: boolean): Promise<NotificationEntity>;
  // Dedupe keys of every notice the user got on the local date (FR 14).
  findKeys(userId: string, localDate: string): Promise<Set<string>>;
  // Newest first; one extra row tells whether there is a next page.
  findPage(query: NoticePageQuery): Promise<NotificationEntity[]>;
  findPendingDeliveries(now: Date, limit: number): Promise<PendingDelivery[]>;
  // SENT deliveries with a ticket between `newerThan` and `olderThan` (FR 27 step 4).
  findSentTickets(olderThan: Date, newerThan: Date, limit: number): Promise<SentTicket[]>;
  getUnreadStats(userId: string): Promise<UnreadStats>;
  markAllRead(userId: string, before: Date, now: Date): Promise<void>;
  // False when the notice is not the user's.
  markRead(userId: string, id: string, now: Date): Promise<boolean>;
  // Section 4: the items of one family leave the user's center (a notice left without items goes too).
  removeFamilyItems(userId: string, familyId: string): Promise<void>;
  // Section 4 / account deletion: everything of a family for every user.
  removeFamilyItemsForAll(familyId: string): Promise<void>;
  updateDeliveries(updates: DeliveryUpdate[]): Promise<void>;
};
export interface NoticePageQuery {
  cursor?: { createdAt: Date; id: string };
  limit: number;
  module?: NotificationModule;
  unread?: boolean;
  userId: string;
}
