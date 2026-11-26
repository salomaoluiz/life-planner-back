export interface ExpoMessage extends PushPayload {
  to: string;
}
export interface PushPayload {
  body: string;
  data: { notificationId: string; route: string };
  title: string;
}
// `error` is the provider code (`DeviceNotRegistered`, `MessageRateExceeded`, ...) or `RequestFailed` when the request
// itself failed (network, 5xx): the caller retries those.
export type ExpoReceipt = { error?: string; status: 'error' | 'ok' };
export type ExpoTicket = { error: string; status: 'error' } | { id: string; status: 'ok' };
export interface IPushSender {
  // Receipts of the tickets already sent (up to 1000 ids per call); an id the provider does not know is left out.
  getExpoReceipts(ids: string[]): Promise<Record<string, ExpoReceipt>>;
  // One ticket per message, in the same order.
  sendExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]>;
  // 404/410 -> gone (delete the device), 429/5xx/network or missing VAPID keys -> retry.
  sendWeb(subscription: WebSubscription, payload: PushPayload): Promise<WebSendResult>;
}
export type WebSendResult = { gone: true } | { ok: true } | { retry: true };
export interface WebSubscription {
  auth: string;
  endpoint: string;
  p256dh: string;
}
