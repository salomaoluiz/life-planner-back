import {
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  INotificationDeviceRepository,
  INotificationPreferenceRepository,
} from '@notification/domain/repository';
import {
  DEVICE_NOT_REGISTERED,
  TEST_PUSH_LIMIT,
  TEST_PUSH_WINDOW_MS,
} from '@notification/domain/service/DeliveryRetry';
import { testPushTitle } from '@notification/domain/service/SummaryComposer';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IPushSender } from '@shared/infra/push/types';

export interface SendTestPushInput {
  // The calling device (`X-Device-Id`), used when no `deviceId` is sent.
  currentDeviceId?: string;
  deviceId?: string;
  now?: Date;
  userId: string;
}

// Spec 124 FR 25: a test push to one device of the user right away, ignoring quiet hours, not stored in the center.
// 5 per user per hour (in memory, like the quote refresh cooldown: one API instance, spec 031).
export class SendTestPushUseCase implements UseCaseWithParams<SendTestPushInput, void> {
  private readonly calls = new Map<string, number[]>();

  constructor(
    @Inject('INotificationDeviceRepository')
    private readonly devices: INotificationDeviceRepository,
    @Inject('INotificationPreferenceRepository')
    private readonly preferences: INotificationPreferenceRepository,
    @Inject('IPushSender') private readonly push: IPushSender,
  ) {}

  private consume(userId: string, at: number): void {
    const recent = (this.calls.get(userId) ?? []).filter((time) => at - time < TEST_PUSH_WINDOW_MS);

    if (recent.length >= TEST_PUSH_LIMIT) {
      throw new HttpException(
        { code: 'TEST_PUSH_LIMIT', message: 'Too many test notices' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.calls.set(userId, [...recent, at]);
  }

  async execute(input: SendTestPushInput): Promise<void> {
    const id = input.deviceId ?? input.currentDeviceId;
    const device = id ? await this.devices.findById(id) : undefined;

    if (!device || device.userId !== input.userId) {
      throw new NotFoundException();
    }

    if (!device.enabled) {
      throw new UnprocessableEntityException('This device is turned off');
    }

    this.consume(input.userId, (input.now ?? new Date()).getTime());

    const { locale } = await this.preferences.find(input.userId);
    const payload = {
      body: '',
      data: { notificationId: 'test', route: '/notifications' },
      title: testPushTitle(locale),
    };

    if (device.provider === 'EXPO') {
      const [ticket] = await this.push.sendExpo([{ ...payload, to: device.token }]);

      if (ticket?.status === 'error' && ticket.error === DEVICE_NOT_REGISTERED) {
        await this.devices.delete(device.id);
      }

      return;
    }

    const result = await this.push.sendWeb(
      { auth: device.webAuth ?? '', endpoint: device.token, p256dh: device.webP256dh ?? '' },
      payload,
    );

    if ('gone' in result) {
      await this.devices.delete(device.id);
    }
  }
}
