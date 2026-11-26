import { Inject } from '@nestjs/common';

import { NotificationEntity } from '@notification/domain/entity/NotificationEntity';
import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { NotificationPreferences } from '@notification/domain/entity/NotificationPreferences';
import {
  INotificationPreferenceRepository,
  INotificationRepository,
} from '@notification/domain/repository';
import { localMoment } from '@notification/domain/service/NotificationClock';
import { composeSummary } from '@notification/domain/service/SummaryComposer';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface CreateSummaryNoticeInput {
  // Already filtered by enabled types and families (the collectors' job).
  items: NotificationItemInput[];
  now: Date;
  preferences: NotificationPreferences;
}

// Spec 124 FR 10-11: ONE SUMMARY notice with the items grouped, its deliveries and `lastSummaryOn` in one transaction.
// Without items nothing is created or sent, but `lastSummaryOn` is still set. The summary is never delayed by quiet hours.
export class CreateSummaryNoticeUseCase implements UseCaseWithParams<
  CreateSummaryNoticeInput,
  NotificationEntity | null
> {
  constructor(
    @Inject('INotificationRepository') private readonly notices: INotificationRepository,
    @Inject('INotificationPreferenceRepository')
    private readonly preferences: INotificationPreferenceRepository,
  ) {}

  async execute(input: CreateSummaryNoticeInput): Promise<NotificationEntity | null> {
    const { items, now, preferences } = input;
    const { date } = localMoment(now, preferences.timeZone);
    const composed = composeSummary(items, preferences.locale);

    if (!composed) {
      await this.preferences.setLastSummaryOn(preferences.userId, date);

      return null;
    }

    return this.notices.create(
      {
        body: composed.body,
        items: composed.items,
        kind: 'SUMMARY',
        localDate: date,
        pushAt: now,
        title: composed.title,
        userId: preferences.userId,
      },
      true,
    );
  }
}
