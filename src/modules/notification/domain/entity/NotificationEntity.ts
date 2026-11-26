import { NotificationItem } from '@notification/domain/entity/NotificationItem';
import { NotificationKind } from '@notification/domain/enum';

export interface NotificationEntity {
  body: string;
  createdAt: Date;
  id: string;
  items: NotificationItem[];
  kind: NotificationKind;
  localDate: string;
  readAt: Date | null;
  title: string;
  userId: string;
}

// A notice about to be written (FR 10, 14): the repository adds one PENDING delivery per enabled device.
export interface DeliveryUpdate {
  attempts?: number;
  error?: null | string;
  id: string;
  nextAttemptAt?: Date;
  sentAt?: Date;
  status: 'FAILED' | 'INVALID' | 'PENDING' | 'SENT';
  ticketId?: null | string;
}
export interface NewNotification {
  body: string;
  items: NotificationItem[];
  kind: NotificationKind;
  localDate: string;
  title: string;
  userId: string;
  // Urgent notices found during quiet hours wait for the end of the window (FR 16).
  pushAt: Date;
}
export interface PendingDelivery {
  attempts: number;
  body: string;
  deviceId: string;
  id: string;
  notificationId: string;
  provider: 'EXPO' | 'WEB_PUSH';
  route: string;
  title: string;
  token: string;
  webAuth: null | string;
  webP256dh: null | string;
}
export interface SentTicket {
  deliveryId: string;
  deviceId: string;
  ticketId: string;
}
export interface UnreadStats {
  count: number;
  lastCreatedAt: Date | null;
  lastReadAt: Date | null;
}
