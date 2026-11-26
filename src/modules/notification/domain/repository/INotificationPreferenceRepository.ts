import { NotificationPreferences } from '@notification/domain/entity/NotificationPreferences';

export type INotificationPreferenceRepository = {
  // Families turned off, by user (a missing row means on).
  findDisabledFamilyIds(userIds: string[]): Promise<Map<string, Set<string>>>;
  // Users that may be due now: their local time reached the summary time, or their summary of the local date exists
  // (FR 9, 14). Keyset pages by user id; the caller still checks the exact rule with `NotificationClock`.
  findDueUsers(
    now: Date,
    afterUserId: string | undefined,
    limit: number,
  ): Promise<NotificationPreferences[]>;
  // The row, or the defaults when the user never changed anything (FR 35).
  find(userId: string): Promise<NotificationPreferences>;
  // Deletes the family switch of one user (leaving a family).
  removeFamily(userId: string, familyId: string): Promise<void>;
  // Upsert of any subset.
  save(userId: string, patch: PreferencePatch): Promise<NotificationPreferences>;
  setFamilyEnabled(userId: string, familyId: string, enabled: boolean): Promise<void>;
  setLastSummaryOn(userId: string, localDate: string): Promise<void>;
};
export type PreferencePatch = Partial<
  Pick<
    NotificationPreferences,
    | 'billLeadDays'
    | 'disabledTypes'
    | 'invoiceLeadDays'
    | 'locale'
    | 'quietEndMinute'
    | 'quietStartMinute'
    | 'summaryMinute'
    | 'timeZone'
  >
>;
