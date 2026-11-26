import { Inject } from '@nestjs/common';

import { NotificationPreferences } from '@notification/domain/entity/NotificationPreferences';
import { INotificationPreferenceRepository } from '@notification/domain/repository';
import { isDueForSummary, isDueForUrgent } from '@notification/domain/service/NotificationClock';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface DueNotificationUser {
  disabledFamilyIds: Set<string>;
  preferences: NotificationPreferences;
  summaryDue: boolean;
  urgentDue: boolean;
}
export interface FindDueNotificationUsersInput {
  afterUserId?: string;
  limit: number;
  now: Date;
}
export interface FindDueNotificationUsersOutput {
  // True WHEN the page was full: ask again with `afterUserId`.
  hasMore: boolean;
  lastUserId?: string;
  users: DueNotificationUser[];
}

// Spec 124 FR 9, 14, 29: a page of users who are due for the summary or for urgent notices, with their family switches.
// The datasource narrows by time in SQL; the exact rule is the pure `NotificationClock` (a DST-proof second look).
export class FindDueNotificationUsersUseCase implements UseCaseWithParams<
  FindDueNotificationUsersInput,
  FindDueNotificationUsersOutput
> {
  constructor(
    @Inject('INotificationPreferenceRepository')
    private readonly repository: INotificationPreferenceRepository,
  ) {}

  async execute(input: FindDueNotificationUsersInput): Promise<FindDueNotificationUsersOutput> {
    const rows = await this.repository.findDueUsers(input.now, input.afterUserId, input.limit);
    const disabled = await this.repository.findDisabledFamilyIds(rows.map((row) => row.userId));
    const users = rows
      .map((preferences) => ({
        disabledFamilyIds: disabled.get(preferences.userId) ?? new Set<string>(),
        preferences,
        summaryDue: isDueForSummary(preferences, input.now),
        urgentDue: isDueForUrgent(preferences, input.now),
      }))
      .filter((user) => user.summaryDue || user.urgentDue);

    return {
      hasMore: rows.length === input.limit,
      lastUserId: rows[rows.length - 1]?.userId,
      users,
    };
  }
}
