import { Injectable } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import * as webpush from 'web-push';

import { EnvService } from '@shared/infra/env/env.service';

import {
  ExpoMessage,
  ExpoReceipt,
  ExpoTicket,
  IPushSender,
  PushPayload,
  WebSendResult,
  WebSubscription,
} from './types';

const GONE_STATUS = [404, 410];
const REQUEST_FAILED = 'RequestFailed';

// Spec 124 section 6: the only place that talks to the Expo Push Service and to Web Push endpoints. Logs nothing:
// tokens, endpoints and keys must never reach a log (section 11).
@Injectable()
export class PushSender implements IPushSender {
  private readonly expo: Expo;

  constructor(private readonly env: EnvService) {
    this.expo = new Expo({ accessToken: this.env.expoAccessToken });
  }

  async getExpoReceipts(ids: string[]): Promise<Record<string, ExpoReceipt>> {
    const receipts: Record<string, ExpoReceipt> = {};

    for (const chunk of this.expo.chunkPushNotificationReceiptIds(ids)) {
      try {
        const found = await this.expo.getPushNotificationReceiptsAsync(chunk);

        for (const [id, receipt] of Object.entries(found)) {
          receipts[id] =
            receipt.status === 'ok'
              ? { status: 'ok' }
              : { error: receipt.details?.error ?? receipt.message, status: 'error' };
        }
      } catch {
        // The next tick asks again (the delivery stays SENT until the 24 h window closes).
      }
    }

    return receipts;
  }

  async sendExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
    const tickets: ExpoTicket[] = [];
    const prepared: ExpoPushMessage[] = messages.map((message) => ({
      ...message,
      sound: 'default',
    }));

    for (const chunk of this.expo.chunkPushNotifications(prepared)) {
      try {
        const sent = await this.expo.sendPushNotificationsAsync(chunk);

        tickets.push(
          ...sent.map(
            (ticket): ExpoTicket =>
              ticket.status === 'ok'
                ? { id: ticket.id, status: 'ok' }
                : { error: ticket.details?.error ?? REQUEST_FAILED, status: 'error' },
          ),
        );
      } catch {
        tickets.push(...chunk.map((): ExpoTicket => ({ error: REQUEST_FAILED, status: 'error' })));
      }
    }

    return tickets;
  }

  async sendWeb(subscription: WebSubscription, payload: PushPayload): Promise<WebSendResult> {
    const { vapidPrivateKey, vapidPublicKey, vapidSubject } = this.env;

    if (!vapidPrivateKey || !vapidPublicKey || !vapidSubject) {
      return { retry: true };
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { auth: subscription.auth, p256dh: subscription.p256dh },
        },
        JSON.stringify(payload),
        {
          TTL: 86_400,
          vapidDetails: {
            privateKey: vapidPrivateKey,
            publicKey: vapidPublicKey,
            subject: vapidSubject,
          },
        },
      );

      return { ok: true };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;

      return status !== undefined && GONE_STATUS.includes(status)
        ? { gone: true }
        : { retry: true };
    }
  }
}
