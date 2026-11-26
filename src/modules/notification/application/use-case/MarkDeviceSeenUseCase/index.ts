import { Inject, NotFoundException } from '@nestjs/common';

import { NotificationLocale } from '@notification/domain/enum';
import {
  INotificationDeviceRepository,
  INotificationPreferenceRepository,
} from '@notification/domain/repository';
import { isValidTimeZone } from '@notification/domain/service/NotificationClock';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ValidationError } from '@shared/domain/error/ValidationError';

export interface MarkDeviceSeenInput {
  id: string;
  locale: NotificationLocale;
  now?: Date;
  timeZone: string;
  userId: string;
}

// Spec 124 FR 23: sets `lastSeenAt` and copies the time zone and locale to the user (the latest device wins).
export class MarkDeviceSeenUseCase implements UseCaseWithParams<MarkDeviceSeenInput, void> {
  constructor(
    @Inject('INotificationDeviceRepository')
    private readonly devices: INotificationDeviceRepository,
    @Inject('INotificationPreferenceRepository')
    private readonly preferences: INotificationPreferenceRepository,
  ) {}

  async execute(input: MarkDeviceSeenInput): Promise<void> {
    if (!isValidTimeZone(input.timeZone)) {
      throw new ValidationError([
        { code: 'invalid_time_zone', field: 'timeZone', message: 'Unknown time zone' },
      ]);
    }

    const device = await this.devices.findById(input.id);

    if (!device || device.userId !== input.userId) {
      throw new NotFoundException();
    }

    await this.devices.markSeen(input.id, input.now ?? new Date());
    await this.preferences.save(input.userId, { locale: input.locale, timeZone: input.timeZone });
  }
}
