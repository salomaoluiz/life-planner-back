import {
  NotificationDevice,
  RegisterDeviceParams,
} from '@notification/domain/entity/NotificationDevice';

export type INotificationDeviceRepository = {
  // Devices unseen since `cutoff` (FR 24, 28); returns how many were deleted.
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  deleteStale(cutoff: Date): Promise<number>;
  findById(id: string): Promise<NotificationDevice | undefined>;
  findByUser(userId: string): Promise<NotificationDevice[]>;
  // Sets `lastSeenAt` to `now`.
  markSeen(id: string, now: Date): Promise<void>;
  // Upsert by token: the row moves to the caller when it belonged to someone else (FR 22).
  register(
    params: RegisterDeviceParams,
    now: Date,
  ): Promise<{ created: boolean; device: NotificationDevice }>;
  update(id: string, patch: { enabled?: boolean; name?: string }): Promise<NotificationDevice>;
};
