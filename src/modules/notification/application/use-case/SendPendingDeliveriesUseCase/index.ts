import { Inject } from '@nestjs/common';

import { DeliveryUpdate, PendingDelivery } from '@notification/domain/entity/NotificationEntity';
import {
  INotificationDeviceRepository,
  INotificationRepository,
} from '@notification/domain/repository';
import {
  afterFailure,
  DELIVERY_BATCH_LIMIT,
  DEVICE_NOT_REGISTERED,
  EXPO_BATCH_SIZE,
  WEB_PARALLEL,
} from '@notification/domain/service/DeliveryRetry';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IPushSender } from '@shared/infra/push/types';

export interface SendPendingDeliveriesResult {
  failed: number;
  invalid: number;
  retried: number;
  sent: number;
}

// Spec 124 FR 27 step 3. Expo: batches of 100 messages, a ticket per message (`ok` -> SENT with the ticket id,
// `DeviceNotRegistered` -> INVALID and the device is deleted). Web Push: one request per subscription, at most 20 in
// parallel (404/410 -> INVALID and the device is deleted; 429/5xx/network -> retry after 1, 5, 15 minutes, FAILED after the
// 4th attempt). Nothing here logs tokens, endpoints or notice text.
export class SendPendingDeliveriesUseCase implements UseCaseWithParams<
  { now?: Date } | undefined,
  SendPendingDeliveriesResult
> {
  constructor(
    @Inject('INotificationRepository') private readonly notices: INotificationRepository,
    @Inject('INotificationDeviceRepository')
    private readonly devices: INotificationDeviceRepository,
    @Inject('IPushSender') private readonly push: IPushSender,
  ) {}

  async execute(input?: { now?: Date }): Promise<SendPendingDeliveriesResult> {
    const now = input?.now ?? new Date();
    const pending = await this.notices.findPendingDeliveries(now, DELIVERY_BATCH_LIMIT);
    const updates: DeliveryUpdate[] = [];
    const goneDevices = new Set<string>();

    await this.sendExpo(
      pending.filter((delivery) => delivery.provider === 'EXPO'),
      now,
      updates,
      goneDevices,
    );
    await this.sendWeb(
      pending.filter((delivery) => delivery.provider === 'WEB_PUSH'),
      now,
      updates,
      goneDevices,
    );

    await this.notices.updateDeliveries(updates);

    if (goneDevices.size > 0) {
      await this.devices.deleteMany([...goneDevices]);
    }

    function count(status: DeliveryUpdate['status']) {
      return updates.filter((update) => update.status === status).length;
    }

    return {
      failed: count('FAILED'),
      invalid: count('INVALID'),
      retried: count('PENDING'),
      sent: count('SENT'),
    };
  }

  private retry(delivery: PendingDelivery, now: Date, error: string): DeliveryUpdate {
    const outcome = afterFailure(delivery.attempts, now);

    return {
      attempts: outcome.attempts,
      error,
      id: delivery.id,
      nextAttemptAt: outcome.status === 'PENDING' ? outcome.nextAttemptAt : undefined,
      status: outcome.status,
    };
  }

  private async sendExpo(
    deliveries: PendingDelivery[],
    now: Date,
    updates: DeliveryUpdate[],
    goneDevices: Set<string>,
  ): Promise<void> {
    for (let start = 0; start < deliveries.length; start += EXPO_BATCH_SIZE) {
      const batch = deliveries.slice(start, start + EXPO_BATCH_SIZE);
      const tickets = await this.push.sendExpo(
        batch.map((delivery) => ({
          body: delivery.body,
          data: { notificationId: delivery.notificationId, route: delivery.route },
          title: delivery.title,
          to: delivery.token,
        })),
      );

      batch.forEach((delivery, index) => {
        const ticket = tickets[index];

        if (ticket?.status === 'ok') {
          updates.push({ id: delivery.id, sentAt: now, status: 'SENT', ticketId: ticket.id });
        } else if (ticket?.status === 'error' && ticket.error === DEVICE_NOT_REGISTERED) {
          updates.push({ error: DEVICE_NOT_REGISTERED, id: delivery.id, status: 'INVALID' });
          goneDevices.add(delivery.deviceId);
        } else {
          updates.push(
            this.retry(delivery, now, ticket?.status === 'error' ? ticket.error : 'NoTicket'),
          );
        }
      });
    }
  }

  private async sendWeb(
    deliveries: PendingDelivery[],
    now: Date,
    updates: DeliveryUpdate[],
    goneDevices: Set<string>,
  ): Promise<void> {
    for (let start = 0; start < deliveries.length; start += WEB_PARALLEL) {
      const batch = deliveries.slice(start, start + WEB_PARALLEL);
      const results = await Promise.all(
        batch.map(async (delivery) =>
          this.push.sendWeb(
            {
              auth: delivery.webAuth ?? '',
              endpoint: delivery.token,
              p256dh: delivery.webP256dh ?? '',
            },
            {
              body: delivery.body,
              data: { notificationId: delivery.notificationId, route: delivery.route },
              title: delivery.title,
            },
          ),
        ),
      );

      batch.forEach((delivery, index) => {
        const result = results[index];

        if ('ok' in result) {
          updates.push({ id: delivery.id, sentAt: now, status: 'SENT' });
        } else if ('gone' in result) {
          updates.push({ error: 'Gone', id: delivery.id, status: 'INVALID' });
          goneDevices.add(delivery.deviceId);
        } else {
          updates.push(this.retry(delivery, now, 'WebPushRetry'));
        }
      });
    }
  }
}
