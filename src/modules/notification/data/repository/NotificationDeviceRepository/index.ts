import { Inject, Injectable } from '@nestjs/common';

import { NotificationMapper } from '@notification/data/datasource/mapper/NotificationMapper';
import { INotificationDeviceDatasource } from '@notification/data/repository/datasource/INotificationDeviceDatasource';
import {
  NotificationDevice,
  RegisterDeviceParams,
} from '@notification/domain/entity/NotificationDevice';
import { INotificationDeviceRepository } from '@notification/domain/repository';

@Injectable()
export class NotificationDeviceRepository implements INotificationDeviceRepository {
  constructor(
    @Inject('INotificationDeviceDatasource')
    private readonly datasource: INotificationDeviceDatasource,
  ) {}

  async delete(id: string): Promise<void> {
    await this.datasource.delete(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.datasource.deleteMany(ids);
  }

  async deleteStale(cutoff: Date): Promise<number> {
    return this.datasource.deleteStale(cutoff);
  }

  async findById(id: string): Promise<NotificationDevice | undefined> {
    const row = await this.datasource.findById(id);

    return row ? NotificationMapper.toDevice(row) : undefined;
  }

  async findByUser(userId: string): Promise<NotificationDevice[]> {
    const rows = await this.datasource.findByUser(userId);

    return rows.map((row) => NotificationMapper.toDevice(row));
  }

  async markSeen(id: string, now: Date): Promise<void> {
    await this.datasource.touch(id, now);
  }

  async register(
    params: RegisterDeviceParams,
    now: Date,
  ): Promise<{ created: boolean; device: NotificationDevice }> {
    const existing = await this.datasource.findByToken(params.token);
    const row = await this.datasource.upsert(
      {
        name: params.name,
        platform: params.platform,
        provider: params.provider,
        token: params.token,
        user_id: params.userId,
        web_auth: params.webAuth ?? null,
        web_p256dh: params.webP256dh ?? null,
      },
      now,
    );

    return { created: !existing, device: NotificationMapper.toDevice(row) };
  }

  async update(
    id: string,
    patch: { enabled?: boolean; name?: string },
  ): Promise<NotificationDevice> {
    return NotificationMapper.toDevice(await this.datasource.update(id, patch));
  }
}
