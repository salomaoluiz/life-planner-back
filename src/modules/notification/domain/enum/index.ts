// Same values as the Prisma enums and the API (spec 124 section 6); literal unions so rows map without casts.
export const NOTIFICATION_TYPES = [
  'STOCK_EXPIRING',
  'STOCK_OPENED_EXPIRING',
  'FINANCE_BILL_DUE',
  'FINANCE_INVOICE_DUE',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_MODULES = ['STOCK', 'FINANCE'] as const;
export type NotificationModule = (typeof NOTIFICATION_MODULES)[number];

export const NOTIFICATION_KINDS = ['SUMMARY', 'URGENT'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_ITEM_STATES = ['DUE_TODAY', 'OVERDUE', 'UPCOMING'] as const;
export type DeliveryStatus = 'FAILED' | 'INVALID' | 'PENDING' | 'SENT';
export type DevicePlatform = 'ANDROID' | 'IOS' | 'WEB';
export type NotificationItemState = (typeof NOTIFICATION_ITEM_STATES)[number];
export type PushProvider = 'EXPO' | 'WEB_PUSH';

export const NOTIFICATION_LOCALES = ['pt-BR', 'en-US'] as const;
export type NotificationLocale = (typeof NOTIFICATION_LOCALES)[number];

// Spec 124 FR 26: ticks must land on the same minutes every hour.
export const ALLOWED_TICK_MINUTES = [1, 5, 10, 15, 20, 30, 60] as const;
