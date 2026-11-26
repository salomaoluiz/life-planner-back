import { NotificationPreference } from '@db/client';

export interface INotificationPreferenceDatasource {
  deleteFamily(userId: string, familyId: string): Promise<void>;
  find(userId: string): Promise<NotificationPreference | null>;
  findDisabledFamilies(userIds: string[]): Promise<{ family_id: string; user_id: string }[]>;
  // Raw rows with the defaults already applied (a user without a row is returned too).
  findDue(
    now: Date,
    afterUserId: string | undefined,
    limit: number,
  ): Promise<NotificationPreference[]>;
  setFamily(userId: string, familyId: string, enabled: boolean): Promise<void>;
  setLastSummaryOn(userId: string, localDate: string): Promise<void>;
  upsert(userId: string, data: PreferenceWrite): Promise<NotificationPreference>;
}
export interface PreferenceWrite {
  bill_lead_days?: number;
  disabled_types?: NotificationPreference['disabled_types'];
  invoice_lead_days?: number;
  locale?: string;
  quiet_end_minute?: number;
  quiet_start_minute?: number;
  summary_minute?: number;
  time_zone?: string;
}
