import { Inject } from '@nestjs/common';

import { DeliveryUpdate } from '@notification/domain/entity/NotificationEntity';
import {
  INotificationDeviceRepository,
  INotificationRepository,
} from '@notification/domain/repository';
import {
  DEVICE_NOT_REGISTERED,
  RECEIPT_BATCH_LIMIT,
  RECEIPT_MAX_AGE_HOURS,
  RECEIPT_MIN_AGE_MINUTES,
} from '@notification/domain/service/DeliveryRetry';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IPushSender } from '@shared/infra/push/types';

export interface CheckExpoReceiptsResult {
  checked: number;
  devicesDeleted: number;
}

// Spec 124 FR 27 step 4: receipts of the SENT Expo deliveries older than 15 minutes and younger than 24 h (up to 1000
// ids). `DeviceNotRegistered` deletes the device; other receipt errors are logged with the provider code only (no
// resend). A checked delivery drops its ticket id so the next tick does not ask again.
export class CheckExpoReceiptsUseCase implements UseCaseWithParams<
  { now?: Date } | undefined,
  CheckExpoReceiptsResult
> {
  constructor(
    @Inject('INotificationRepository') private readonly notices: INotificationRepository,
    @Inject('INotificationDeviceRepository')
    private readonly devices: INotificationDeviceRepository,
    @Inject('IPushSender') private readonly push: IPushSender,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  async execute(input?: { now?: Date }): Promise<CheckExpoReceiptsResult> {
    const now = (input?.now ?? new Date()).getTime();
    const tickets = await this.notices.findSentTickets(
      new Date(now - RECEIPT_MIN_AGE_MINUTES * 60_000),
      new Date(now - RECEIPT_MAX_AGE_HOURS * 3_600_000),
      RECEIPT_BATCH_LIMIT,
    );

    if (tickets.length === 0) {
      return { checked: 0, devicesDeleted: 0 };
    }

    const receipts = await this.push.getExpoReceipts(tickets.map((ticket) => ticket.ticketId));
    const updates: DeliveryUpdate[] = [];
    const goneDevices = new Set<string>();

    for (const ticket of tickets) {
      const receipt = receipts[ticket.ticketId];

      if (!receipt) {
        continue;
      }

      if (receipt.status === 'ok') {
        updates.push({ id: ticket.deliveryId, status: 'SENT', ticketId: null });
        continue;
      }

      const code = receipt.error ?? 'Unknown';

      updates.push({
        error: code,
        id: ticket.deliveryId,
        status: code === DEVICE_NOT_REGISTERED ? 'INVALID' : 'FAILED',
        ticketId: null,
      });

      if (code === DEVICE_NOT_REGISTERED) {
        goneDevices.add(ticket.deviceId);
      } else {
        this.logger.log(LogLevel.WARN, 'Expo receipt error', {
          code,
          module: 'CheckExpoReceiptsUseCase',
        });
      }
    }

    await this.notices.updateDeliveries(updates);

    if (goneDevices.size > 0) {
      await this.devices.deleteMany([...goneDevices]);
    }

    return { checked: updates.length, devicesDeleted: goneDevices.size };
  }
}
