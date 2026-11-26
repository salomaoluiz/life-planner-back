import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';

import {
  RegisterDeviceBodySchema,
  SeenBodySchema,
  UpdateDeviceBodySchema,
} from '@api/notification/v1/dto/notification-device.dto';
import { DeleteNotificationDeviceUseCase } from '@notification/application/use-case/DeleteNotificationDeviceUseCase';
import { ListNotificationDevicesUseCase } from '@notification/application/use-case/ListNotificationDevicesUseCase';
import { MarkDeviceSeenUseCase } from '@notification/application/use-case/MarkDeviceSeenUseCase';
import { RegisterNotificationDeviceUseCase } from '@notification/application/use-case/RegisterNotificationDeviceUseCase';
import { SendTestPushUseCase } from '@notification/application/use-case/SendTestPushUseCase';
import { UpdateNotificationDeviceUseCase } from '@notification/application/use-case/UpdateNotificationDeviceUseCase';
import { NotificationDevice } from '@notification/domain/entity/NotificationDevice';
import { EnvService } from '@shared/infra/env/env.service';

// Section 7: no endpoint exposes the token or the keys of a device.
function toDeviceOutput(device: NotificationDevice, currentDeviceId?: string) {
  return {
    current: device.id === currentDeviceId,
    enabled: device.enabled,
    id: device.id,
    lastSeenAt: device.lastSeenAt.toISOString(),
    name: device.name,
    platform: device.platform,
    provider: device.provider,
  };
}

@Injectable()
export class NotificationDeviceService {
  constructor(
    private readonly deleteNotificationDeviceUseCase: DeleteNotificationDeviceUseCase,
    private readonly env: EnvService,
    private readonly listNotificationDevicesUseCase: ListNotificationDevicesUseCase,
    private readonly markDeviceSeenUseCase: MarkDeviceSeenUseCase,
    private readonly registerNotificationDeviceUseCase: RegisterNotificationDeviceUseCase,
    private readonly sendTestPushUseCase: SendTestPushUseCase,
    private readonly updateNotificationDeviceUseCase: UpdateNotificationDeviceUseCase,
  ) {}

  async delete(userId: string, id: string): Promise<void> {
    await this.deleteNotificationDeviceUseCase.execute({ id, userId });
  }

  async list(userId: string, currentDeviceId?: string) {
    const devices = await this.listNotificationDevicesUseCase.execute({ userId });

    return { items: devices.map((device) => toDeviceOutput(device, currentDeviceId)) };
  }

  async register(userId: string, body: z.output<typeof RegisterDeviceBodySchema>) {
    const { created, id } = await this.registerNotificationDeviceUseCase.execute({
      locale: body.locale,
      name: body.name,
      platform: body.platform,
      provider: body.provider,
      timeZone: body.timeZone,
      token: body.token,
      userId,
      webAuth: body.webKeys?.auth,
      webP256dh: body.webKeys?.p256dh,
    });

    return { created, id };
  }

  async seen(userId: string, id: string, body: z.output<typeof SeenBodySchema>): Promise<void> {
    await this.markDeviceSeenUseCase.execute({
      id,
      locale: body.locale,
      timeZone: body.timeZone,
      userId,
    });
  }

  async sendTest(userId: string, deviceId?: string, currentDeviceId?: string): Promise<void> {
    await this.sendTestPushUseCase.execute({ currentDeviceId, deviceId, userId });
  }

  async update(userId: string, id: string, body: z.output<typeof UpdateDeviceBodySchema>) {
    const device = await this.updateNotificationDeviceUseCase.execute({ ...body, id, userId });

    return toDeviceOutput(device);
  }

  // The VAPID public key for `pushManager.subscribe` (it is public by design).
  webPushKey(): { publicKey: string } {
    const publicKey = this.env.vapidPublicKey;

    if (!publicKey) {
      throw new NotFoundException('Web Push is not configured');
    }

    return { publicKey };
  }
}
