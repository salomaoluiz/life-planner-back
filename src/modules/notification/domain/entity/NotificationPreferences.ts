import { NotificationLocale, NotificationType } from '@notification/domain/enum';

export interface NotificationPreferences {
  billLeadDays: number;
  disabledTypes: NotificationType[];
  invoiceLeadDays: number;
  // YYYY-MM-DD, the local date of the last summary.
  lastSummaryOn: null | string;
  locale: NotificationLocale;
  quietEndMinute: number;
  quietStartMinute: number;
  summaryMinute: number;
  timeZone: string;
  userId: string;
}

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

// FR 35: a user needs no row until the first change.
export function defaultPreferences(userId: string): NotificationPreferences {
  return {
    billLeadDays: 3,
    disabledTypes: [],
    invoiceLeadDays: 3,
    lastSummaryOn: null,
    locale: 'pt-BR',
    quietEndMinute: 420,
    quietStartMinute: 1320,
    summaryMinute: 480,
    timeZone: DEFAULT_TIME_ZONE,
    userId,
  };
}
