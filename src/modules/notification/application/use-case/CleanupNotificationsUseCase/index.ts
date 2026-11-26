import { Inject } from '@nestjs/common';

import {
  INotificationDeviceRepository,
  INotificationRepository,
} from '@notification/domain/repository';
import {
  DELIVERY_RETENTION_DAYS,
  DEVICE_STALE_DAYS,
  NOTICE_RETENTION_DAYS,
} from '@notification/domain/service/DeliveryRetry';
import { UseCaseWithParams } from '@shared/application/use-case/types';

const DAY_MS = 86_400_000;

export interface CleanupNotificationsResult {
  deliveries: number;
  devices: number;
  notices: number;
}

// Spec 124 FR 18, 24, 28: notices older than 30 days (items and deliveries cascade), devices unseen for 60 days and
// deliveries in a final state older than 7 days. Idempotent.
export class CleanupNotificationsUseCase implements UseCaseWithParams<
  { now?: Date } | undefined,
  CleanupNotificationsResult
> {
  constructor(
    @Inject('INotificationRepository') private readonly notices: INotificationRepository,
    @Inject('INotificationDeviceRepository')
    private readonly devices: INotificationDeviceRepository,
  ) {}

  async execute(input?: { now?: Date }): Promise<CleanupNotificationsResult> {
    const now = (input?.now ?? new Date()).getTime();
    const { deliveries, notices } = await this.notices.cleanup(
      new Date(now - NOTICE_RETENTION_DAYS * DAY_MS),
      new Date(now - DELIVERY_RETENTION_DAYS * DAY_MS),
    );
    const devices = await this.devices.deleteStale(new Date(now - DEVICE_STALE_DAYS * DAY_MS));

    return { deliveries, devices, notices };
  }
}
