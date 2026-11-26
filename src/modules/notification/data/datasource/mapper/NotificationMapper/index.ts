import {
  NotificationDevice as DeviceRow,
  NotificationItem as ItemRow,
  Notification as NotificationRow,
  NotificationPreference as PreferenceRow,
} from '@db/client';
import {
  DeliveryWithContext,
  NotificationWithItems,
} from '@notification/data/repository/datasource/INotificationDatasource';
import { NotificationDevice } from '@notification/domain/entity/NotificationDevice';
import {
  NotificationEntity,
  PendingDelivery,
} from '@notification/domain/entity/NotificationEntity';
import {
  NotificationItem,
  NotificationSnapshot,
} from '@notification/domain/entity/NotificationItem';
import { NotificationPreferences } from '@notification/domain/entity/NotificationPreferences';
import { NotificationLocale } from '@notification/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

function day(date: Date) {
  return date.toISOString().slice(0, 10);
}

// The center page the push opens when the notice is a summary.
export const CENTER_ROUTE = '/notifications';

export class NotificationMapper {
  static toDevice(row: DeviceRow): NotificationDevice {
    return {
      enabled: row.enabled,
      id: row.id,
      lastSeenAt: row.last_seen_at,
      name: row.name,
      platform: row.platform,
      provider: row.provider,
      token: row.token,
      userId: row.user_id,
      webAuth: row.web_auth,
      webP256dh: row.web_p256dh,
    };
  }

  static toItem(row: ItemRow): NotificationItem {
    return {
      dedupeKey: row.dedupe_key,
      dueDate: day(row.due_date),
      module: row.module,
      owner: row.owner as OwnerType,
      ownerId: row.owner_id,
      position: row.position,
      route: row.route,
      snapshot: row.snapshot as unknown as NotificationSnapshot,
      sourceId: row.source_id,
      state: row.state,
      type: row.type,
    };
  }

  static toNotification(row: NotificationWithItems): NotificationEntity {
    return {
      body: row.body,
      createdAt: row.created_at,
      id: row.id,
      items: row.items.map((item) => NotificationMapper.toItem(item)),
      kind: row.kind,
      localDate: day(row.local_date),
      readAt: row.read_at,
      title: row.title,
      userId: row.user_id,
    };
  }

  static toPendingDelivery(row: DeliveryWithContext): PendingDelivery {
    const notice: { items: ItemRow[] } & NotificationRow = row.notification;

    return {
      attempts: row.attempts,
      body: notice.body,
      deviceId: row.device_id,
      id: row.id,
      notificationId: notice.id,
      provider: row.device.provider,
      // An urgent notice opens its item; a summary opens the center.
      route: notice.kind === 'URGENT' ? (notice.items[0]?.route ?? CENTER_ROUTE) : CENTER_ROUTE,
      title: notice.title,
      token: row.device.token,
      webAuth: row.device.web_auth,
      webP256dh: row.device.web_p256dh,
    };
  }

  static toPreferences(row: PreferenceRow): NotificationPreferences {
    return {
      billLeadDays: row.bill_lead_days,
      disabledTypes: row.disabled_types,
      invoiceLeadDays: row.invoice_lead_days,
      lastSummaryOn: row.last_summary_on ? day(row.last_summary_on) : null,
      locale: row.locale as NotificationLocale,
      quietEndMinute: row.quiet_end_minute,
      quietStartMinute: row.quiet_start_minute,
      summaryMinute: row.summary_minute,
      timeZone: row.time_zone,
      userId: row.user_id,
    };
  }
}
