import { DevicePlatform, NotificationDevice, PushProvider } from '@db/client';

export interface DeviceUpsert {
  name: string;
  platform: DevicePlatform;
  provider: PushProvider;
  token: string;
  user_id: string;
  web_auth: null | string;
  web_p256dh: null | string;
}
export interface INotificationDeviceDatasource {
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  deleteStale(cutoff: Date): Promise<number>;
  findById(id: string): Promise<NotificationDevice | null>;
  findByToken(token: string): Promise<NotificationDevice | null>;
  findByUser(userId: string): Promise<NotificationDevice[]>;
  touch(id: string, now: Date): Promise<void>;
  update(id: string, data: { enabled?: boolean; name?: string }): Promise<NotificationDevice>;
  // Upsert by token: an existing row moves to `user_id` and is refreshed.
  upsert(data: DeviceUpsert, now: Date): Promise<NotificationDevice>;
}
