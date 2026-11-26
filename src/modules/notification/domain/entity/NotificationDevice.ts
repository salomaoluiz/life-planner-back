import { DevicePlatform, PushProvider } from '@notification/domain/enum';

export interface NotificationDevice {
  enabled: boolean;
  id: string;
  lastSeenAt: Date;
  name: string;
  platform: DevicePlatform;
  provider: PushProvider;
  // Never leaves the backend (section 11).
  token: string;
  userId: string;
  webAuth: null | string;
  webP256dh: null | string;
}
export interface RegisterDeviceParams {
  name: string;
  platform: DevicePlatform;
  provider: PushProvider;
  token: string;
  userId: string;
  webAuth?: string;
  webP256dh?: string;
}
