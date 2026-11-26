import { Inject } from '@nestjs/common';

import { RegisterDeviceParams } from '@notification/domain/entity/NotificationDevice';
import { NotificationLocale } from '@notification/domain/enum';
import {
  INotificationDeviceRepository,
  INotificationPreferenceRepository,
} from '@notification/domain/repository';
import { isValidTimeZone } from '@notification/domain/service/NotificationClock';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ValidationError } from '@shared/domain/error/ValidationError';

export interface RegisterNotificationDeviceInput extends RegisterDeviceParams {
  locale: NotificationLocale;
  now?: Date;
  timeZone: string;
}

const EXPO_TOKEN = /^(Exponent|Expo)PushToken\[[^\]]+\]$/;

// Spec 124 FR 22: the same token again updates the row; a token that belonged to another user moves to this one.
// The time zone and locale of the device also become the user's (FR 23).
export class RegisterNotificationDeviceUseCase implements UseCaseWithParams<
  RegisterNotificationDeviceInput,
  { created: boolean; id: string }
> {
  constructor(
    @Inject('INotificationDeviceRepository')
    private readonly devices: INotificationDeviceRepository,
    @Inject('INotificationPreferenceRepository')
    private readonly preferences: INotificationPreferenceRepository,
  ) {}

  private assertShape(input: RegisterNotificationDeviceInput): void {
    function invalid(field: string, message: string) {
      return new ValidationError([{ code: 'invalid_device', field, message }]);
    }

    if (input.provider === 'EXPO' && !EXPO_TOKEN.test(input.token)) {
      throw invalid('token', 'Expo tokens look like ExponentPushToken[...]');
    }

    if (input.provider === 'WEB_PUSH') {
      if (!input.token.startsWith('https://')) {
        throw invalid('token', 'Web Push endpoints must be https');
      }

      if (!input.webP256dh || !input.webAuth) {
        throw invalid('webKeys', 'Web Push needs p256dh and auth');
      }
    }

    if (input.provider === 'EXPO' && input.platform === 'WEB') {
      throw invalid('platform', 'Expo devices are iOS or Android');
    }

    if (!isValidTimeZone(input.timeZone)) {
      throw invalid('timeZone', 'Unknown time zone');
    }
  }

  async execute(input: RegisterNotificationDeviceInput): Promise<{ created: boolean; id: string }> {
    this.assertShape(input);

    const { locale, now, timeZone, ...params } = input;
    const { created, device } = await this.devices.register(params, now ?? new Date());

    await this.preferences.save(input.userId, { locale, timeZone });

    return { created, id: device.id };
  }
}
