import { Inject } from '@nestjs/common';

import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { NotificationPreferences } from '@notification/domain/entity/NotificationPreferences';
import { INotificationRepository } from '@notification/domain/repository';
import { localMoment, pushNotBefore } from '@notification/domain/service/NotificationClock';
import { composeUrgent } from '@notification/domain/service/SummaryComposer';
import { selectUrgent } from '@notification/domain/service/UrgentSelector';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface CreateUrgentNoticesInput {
  // The DUE_TODAY candidates already filtered by enabled types and families.
  candidates: NotificationItemInput[];
  now: Date;
  preferences: NotificationPreferences;
}

// Spec 124 FR 14-16: one URGENT notice per DUE_TODAY item whose key is not part of any notice of the local date. During
// quiet hours the notice is created at once but its pushes wait for the end of the window. Returns how many were created.
export class CreateUrgentNoticesUseCase implements UseCaseWithParams<
  CreateUrgentNoticesInput,
  number
> {
  constructor(
    @Inject('INotificationRepository') private readonly notices: INotificationRepository,
  ) {}

  async execute(input: CreateUrgentNoticesInput): Promise<number> {
    const { candidates, now, preferences } = input;
    const dueToday = candidates.filter((item) => item.state === 'DUE_TODAY');

    if (dueToday.length === 0) {
      return 0;
    }

    const { date } = localMoment(now, preferences.timeZone);
    const known = await this.notices.findKeys(preferences.userId, date);
    const selected = selectUrgent(dueToday, known);
    const pushAt = pushNotBefore(preferences, now);

    for (const item of selected) {
      const composed = composeUrgent(item, preferences.locale);

      await this.notices.create(
        {
          body: composed.body,
          items: composed.items,
          kind: 'URGENT',
          localDate: date,
          pushAt,
          title: composed.title,
          userId: preferences.userId,
        },
        false,
      );
    }

    return selected.length;
  }
}
