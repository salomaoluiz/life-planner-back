import { Injectable } from '@nestjs/common';

import { NotificationDevice } from '@db/client';
import {
  DeviceUpsert,
  INotificationDeviceDatasource,
} from '@notification/data/repository/datasource/INotificationDeviceDatasource';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class NotificationDeviceDatasource implements INotificationDeviceDatasource {
  constructor(private readonly db: Database) {}

  async delete(id: string): Promise<void> {
    await this.db.client.notificationDevice.deleteMany({ where: { id } });
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.db.client.notificationDevice.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteStale(cutoff: Date): Promise<number> {
    const result = await this.db.client.notificationDevice.deleteMany({
      where: { last_seen_at: { lt: cutoff } },
    });

    return result.count;
  }

  async findById(id: string): Promise<NotificationDevice | null> {
    return this.db.client.notificationDevice.findUnique({ where: { id } });
  }

  async findByToken(token: string): Promise<NotificationDevice | null> {
    return this.db.client.notificationDevice.findUnique({ where: { token } });
  }

  async findByUser(userId: string): Promise<NotificationDevice[]> {
    return this.db.client.notificationDevice.findMany({
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      where: { user_id: userId },
    });
  }

  async touch(id: string, now: Date): Promise<void> {
    await this.db.client.notificationDevice.updateMany({
      data: { last_seen_at: now },
      where: { id },
    });
  }

  async update(
    id: string,
    data: { enabled?: boolean; name?: string },
  ): Promise<NotificationDevice> {
    return this.db.client.notificationDevice.update({ data, where: { id } });
  }

  async upsert(data: DeviceUpsert, now: Date): Promise<NotificationDevice> {
    return this.db.client.notificationDevice.upsert({
      create: { ...data, last_seen_at: now },
      update: { ...data, last_seen_at: now },
      where: { token: data.token },
    });
  }
}
