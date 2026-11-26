import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { UpdatePreferencesBodySchema } from '@api/notification/v1/dto/notification.dto';
import { NotificationTickService } from '@api/notification/v1/notification-tick.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { GetNotificationPreferencesUseCase } from '@notification/application/use-case/GetNotificationPreferencesUseCase';
import { GetUnreadStatsUseCase } from '@notification/application/use-case/GetUnreadStatsUseCase';
import { ListNotificationsUseCase } from '@notification/application/use-case/ListNotificationsUseCase';
import { MarkAllNotificationsReadUseCase } from '@notification/application/use-case/MarkAllNotificationsReadUseCase';
import { MarkNotificationReadUseCase } from '@notification/application/use-case/MarkNotificationReadUseCase';
import { UpdateNotificationPreferencesUseCase } from '@notification/application/use-case/UpdateNotificationPreferencesUseCase';
import { NotificationEntity, UnreadStats } from '@notification/domain/entity/NotificationEntity';
import { NotificationPreferences } from '@notification/domain/entity/NotificationPreferences';
import {
  NOTIFICATION_TYPES,
  NotificationModule,
  NotificationType,
} from '@notification/domain/enum';
import { minuteOfTime, timeOfMinute } from '@notification/domain/service/NotificationClock';
import { EnvService } from '@shared/infra/env/env.service';

type UpdatePreferencesBody = z.output<typeof UpdatePreferencesBodySchema>;

function toNoticeOutput(notice: NotificationEntity) {
  return {
    createdAt: notice.createdAt.toISOString(),
    id: notice.id,
    items: notice.items.map((item) => ({
      dueDate: item.dueDate,
      route: item.route,
      snapshot: item.snapshot,
      state: item.state,
      type: item.type,
    })),
    kind: notice.kind,
    localDate: notice.localDate,
    readAt: notice.readAt ? notice.readAt.toISOString() : null,
    title: notice.title,
  };
}

// Spec 124 section 4: everything here is the caller's own (the user id comes from the JWT, never from the request).
@Injectable()
export class NotificationService {
  constructor(
    private readonly env: EnvService,
    private readonly getNotificationPreferencesUseCase: GetNotificationPreferencesUseCase,
    private readonly getUnreadStatsUseCase: GetUnreadStatsUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly listNotificationsUseCase: ListNotificationsUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
    private readonly tickService: NotificationTickService,
    private readonly updateNotificationPreferencesUseCase: UpdateNotificationPreferencesUseCase,
  ) {}

  private async activeFamilies(userId: string) {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return families.filter((family) => !family.archived);
  }

  async getPreferences(userId: string) {
    const [output, families] = await Promise.all([
      this.getNotificationPreferencesUseCase.execute({ userId }),
      this.activeFamilies(userId),
    ]);

    return this.toPreferencesOutput(output.preferences, output.disabledFamilyIds, families);
  }

  async getUnreadStats(userId: string): Promise<UnreadStats> {
    return this.getUnreadStatsUseCase.execute({ userId });
  }

  async list(
    userId: string,
    query: { cursor?: string; module?: NotificationModule; unread?: boolean },
  ) {
    const page = await this.listNotificationsUseCase.execute({ ...query, userId });

    return { items: page.items.map(toNoticeOutput), nextCursor: page.nextCursor };
  }

  async markAllRead(userId: string, before?: string): Promise<void> {
    await this.markAllNotificationsReadUseCase.execute({
      before: before ? new Date(before) : undefined,
      userId,
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.markNotificationReadUseCase.execute({ id, userId });
  }

  async summaryPreview(userId: string, now = new Date()) {
    const { disabledFamilyIds, preferences } = await this.getNotificationPreferencesUseCase.execute(
      {
        userId,
      },
    );
    const items = await this.tickService.preview(preferences, new Set(disabledFamilyIds), now);

    return { count: items.length, hasItems: items.length > 0 };
  }

  private toPreferencesOutput(
    preferences: NotificationPreferences,
    disabledFamilyIds: string[],
    families: { familyId: string; name: string }[],
  ) {
    return {
      billLeadDays: preferences.billLeadDays,
      families: families.map((family) => ({
        enabled: !disabledFamilyIds.includes(family.familyId),
        familyId: family.familyId,
        name: family.name,
      })),
      invoiceLeadDays: preferences.invoiceLeadDays,
      locale: preferences.locale,
      quietEnd: timeOfMinute(preferences.quietEndMinute),
      quietStart: timeOfMinute(preferences.quietStartMinute),
      summaryTime: timeOfMinute(preferences.summaryMinute),
      tickMinutes: this.env.notificationTickMinutes,
      timeZone: preferences.timeZone,
      types: Object.fromEntries(
        NOTIFICATION_TYPES.map((type) => [type, !preferences.disabledTypes.includes(type)]),
      ) as Record<NotificationType, boolean>,
    };
  }

  async updatePreferences(userId: string, body: UpdatePreferencesBody) {
    const families = await this.activeFamilies(userId);
    const current = await this.getNotificationPreferencesUseCase.execute({ userId });
    const output = await this.updateNotificationPreferencesUseCase.execute({
      families: body.families,
      memberFamilyIds: families.map((family) => family.familyId),
      patch: {
        billLeadDays: body.billLeadDays,
        disabledTypes: body.types
          ? disabledTypesAfter(current.preferences.disabledTypes, body.types)
          : undefined,
        invoiceLeadDays: body.invoiceLeadDays,
        locale: body.locale,
        quietEndMinute: body.quietEnd === undefined ? undefined : minuteOfTime(body.quietEnd),
        quietStartMinute: body.quietStart === undefined ? undefined : minuteOfTime(body.quietStart),
        summaryMinute: body.summaryTime === undefined ? undefined : minuteOfTime(body.summaryTime),
        timeZone: body.timeZone,
      },
      tickMinutes: this.env.notificationTickMinutes,
      userId,
    });

    return this.toPreferencesOutput(output.preferences, output.disabledFamilyIds, families);
  }
}

// The `types` of a PATCH is a partial map: the ones not sent keep what they had.
function disabledTypesAfter(
  current: NotificationType[],
  types: Partial<Record<NotificationType, boolean>>,
): NotificationType[] {
  return NOTIFICATION_TYPES.filter((type) => {
    const enabled = types[type];

    return enabled === undefined ? current.includes(type) : !enabled;
  });
}
