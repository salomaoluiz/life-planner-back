import { Inject, Injectable } from '@nestjs/common';

import { NotificationMapper } from '@notification/data/datasource/mapper/NotificationMapper';
import { INotificationPreferenceDatasource } from '@notification/data/repository/datasource/INotificationPreferenceDatasource';
import {
  defaultPreferences,
  NotificationPreferences,
} from '@notification/domain/entity/NotificationPreferences';
import {
  INotificationPreferenceRepository,
  PreferencePatch,
} from '@notification/domain/repository';

@Injectable()
export class NotificationPreferenceRepository implements INotificationPreferenceRepository {
  constructor(
    @Inject('INotificationPreferenceDatasource')
    private readonly datasource: INotificationPreferenceDatasource,
  ) {}

  async find(userId: string): Promise<NotificationPreferences> {
    const row = await this.datasource.find(userId);

    return row ? NotificationMapper.toPreferences(row) : defaultPreferences(userId);
  }

  async findDisabledFamilyIds(userIds: string[]): Promise<Map<string, Set<string>>> {
    const rows = await this.datasource.findDisabledFamilies(userIds);
    const byUser = new Map<string, Set<string>>();

    for (const row of rows) {
      byUser.set(row.user_id, (byUser.get(row.user_id) ?? new Set()).add(row.family_id));
    }

    return byUser;
  }

  async findDueUsers(
    now: Date,
    afterUserId: string | undefined,
    limit: number,
  ): Promise<NotificationPreferences[]> {
    const rows = await this.datasource.findDue(now, afterUserId, limit);

    return rows.map((row) => NotificationMapper.toPreferences(row));
  }

  async removeFamily(userId: string, familyId: string): Promise<void> {
    await this.datasource.deleteFamily(userId, familyId);
  }

  async save(userId: string, patch: PreferencePatch): Promise<NotificationPreferences> {
    const row = await this.datasource.upsert(userId, {
      bill_lead_days: patch.billLeadDays,
      disabled_types: patch.disabledTypes,
      invoice_lead_days: patch.invoiceLeadDays,
      locale: patch.locale,
      quiet_end_minute: patch.quietEndMinute,
      quiet_start_minute: patch.quietStartMinute,
      summary_minute: patch.summaryMinute,
      time_zone: patch.timeZone,
    });

    return NotificationMapper.toPreferences(row);
  }

  async setFamilyEnabled(userId: string, familyId: string, enabled: boolean): Promise<void> {
    await this.datasource.setFamily(userId, familyId, enabled);
  }

  async setLastSummaryOn(userId: string, localDate: string): Promise<void> {
    await this.datasource.setLastSummaryOn(userId, localDate);
  }
}
