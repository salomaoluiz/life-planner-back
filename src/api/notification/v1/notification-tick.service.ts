import { Inject, Injectable } from '@nestjs/common';

import { FinanceNoticeCollector } from '@api/notification/v1/collectors/FinanceNoticeCollector';
import { StockNoticeCollector } from '@api/notification/v1/collectors/StockNoticeCollector';
import { INoticeCollector } from '@api/notification/v1/collectors/types';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { CheckExpoReceiptsUseCase } from '@notification/application/use-case/CheckExpoReceiptsUseCase';
import { CleanupNotificationsUseCase } from '@notification/application/use-case/CleanupNotificationsUseCase';
import { CreateSummaryNoticeUseCase } from '@notification/application/use-case/CreateSummaryNoticeUseCase';
import { CreateUrgentNoticesUseCase } from '@notification/application/use-case/CreateUrgentNoticesUseCase';
import {
  DueNotificationUser,
  FindDueNotificationUsersUseCase,
} from '@notification/application/use-case/FindDueNotificationUsersUseCase';
import { SendPendingDeliveriesUseCase } from '@notification/application/use-case/SendPendingDeliveriesUseCase';
import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { NotificationPreferences } from '@notification/domain/entity/NotificationPreferences';
import { filterItemsForUser, ownerKey } from '@notification/domain/service/NoticeFilter';
import { localMoment } from '@notification/domain/service/NotificationClock';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ILogger, LogLevel } from '@shared/infra/logger/types';

const PAGE_SIZE = 200;
// FR 26 step 5: the daily cleanup runs on the first tick after 03:00 UTC.
const CLEANUP_HOUR_UTC = 3;

export interface TickStepResult {
  created: number;
  failedUsers: number;
  users: number;
}

type Mode = 'summary' | 'urgent';
interface Target {
  ownerNames: Record<string, string>;
  owners: Map<string, { owner: OwnerType; ownerId: string }>;
  user: DueNotificationUser;
}

// Spec 124 FR 26, 29: the five steps of one tick. It lives in `src/api` because it combines modules (family access, stock
// and finance collectors, the notification use cases). Every step is isolated: one failure never stops the others, and the
// first error is rethrown at the end so the scheduler reports it (job tag `notification-tick`). Logs carry counts only.
@Injectable()
export class NotificationTickService {
  private cleanedOn?: string;

  constructor(
    private readonly checkExpoReceiptsUseCase: CheckExpoReceiptsUseCase,
    private readonly cleanupNotificationsUseCase: CleanupNotificationsUseCase,
    private readonly createSummaryNoticeUseCase: CreateSummaryNoticeUseCase,
    private readonly createUrgentNoticesUseCase: CreateUrgentNoticesUseCase,
    private readonly financeNoticeCollector: FinanceNoticeCollector,
    private readonly findDueNotificationUsersUseCase: FindDueNotificationUsersUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly sendPendingDeliveriesUseCase: SendPendingDeliveriesUseCase,
    private readonly stockNoticeCollector: StockNoticeCollector,
  ) {}

  async run(now: Date): Promise<void> {
    const steps: [string, () => Promise<unknown>][] = [
      ['summaries', async () => this.runSummaries(now)],
      ['urgent', async () => this.runUrgent(now)],
      ['deliveries', async () => this.sendPendingDeliveriesUseCase.execute({ now })],
      ['receipts', async () => this.checkExpoReceiptsUseCase.execute({ now })],
      ['cleanup', async () => this.cleanup(now)],
    ];
    let failure: unknown;

    for (const [step, work] of steps) {
      try {
        const result = await work();

        this.logger.log(LogLevel.INFO, 'Notification tick step done', {
          module: 'NotificationTickService',
          result,
          step,
        });
      } catch (error) {
        failure ??= error;
        this.logger.log(LogLevel.ERROR, 'Notification tick step failed', {
          error: error instanceof Error ? error.message : 'unknown',
          module: 'NotificationTickService',
          step,
        });
      }
    }

    if (failure) {
      throw failure;
    }
  }

  // `GET /notifications/summary-preview` (FR 32): the items the summary would have now for ONE user, with the same
  // collectors and rules, creating nothing. A collector failure is an error here (the caller asked for the answer).
  private async cleanup(now: Date): Promise<unknown> {
    const day = now.toISOString().slice(0, 10);

    if (now.getUTCHours() < CLEANUP_HOUR_UTC || this.cleanedOn === day) {
      return 'skipped';
    }

    const result = await this.cleanupNotificationsUseCase.execute({ now });

    this.cleanedOn = day;

    return result;
  }

  async preview(
    preferences: NotificationPreferences,
    disabledFamilyIds: Set<string>,
    now: Date,
  ): Promise<NotificationItemInput[]> {
    const target = await this.resolveTarget({
      disabledFamilyIds,
      preferences,
      summaryDue: true,
      urgentDue: false,
    });
    const { date } = localMoment(now, preferences.timeZone);
    const collected = await this.collect(date, [target], true);

    return this.itemsFor(target, collected ?? [], date);
  }

  async runSummaries(now: Date): Promise<TickStepResult> {
    return this.process(now, 'summary');
  }

  async runUrgent(now: Date): Promise<TickStepResult> {
    return this.process(now, 'urgent');
  }

  // Pages of due users: owners are resolved per user, then each module is read ONCE per local date for the union of the
  // page's owners (users that share a family reuse the family's rows); the rest is in-memory filtering per user.
  private async process(now: Date, mode: Mode): Promise<TickStepResult> {
    const result: TickStepResult = { created: 0, failedUsers: 0, users: 0 };
    let afterUserId: string | undefined;

    for (;;) {
      const page = await this.findDueNotificationUsersUseCase.execute({
        afterUserId,
        limit: PAGE_SIZE,
        now,
      });
      const due = page.users.filter((user) =>
        mode === 'summary' ? user.summaryDue : user.urgentDue && !user.summaryDue,
      );

      await this.processPage(now, mode, due, result);

      if (!page.hasMore) {
        return result;
      }
      afterUserId = page.lastUserId;
    }
  }

  private async processPage(
    now: Date,
    mode: Mode,
    due: DueNotificationUser[],
    result: TickStepResult,
  ): Promise<void> {
    const targets = new Map<string, Target>();
    const byDate = new Map<string, Target[]>();

    for (const user of due) {
      const target = await this.resolveTarget(user);
      const { date } = localMoment(now, user.preferences.timeZone);

      targets.set(user.preferences.userId, target);
      byDate.set(date, [...(byDate.get(date) ?? []), target]);
    }

    for (const [localDate, group] of byDate) {
      const collected = await this.collect(localDate, group);

      for (const target of group) {
        result.users += 1;

        if (!collected) {
          result.failedUsers += 1;
          continue;
        }

        try {
          result.created += await this.notify(mode, target, collected, localDate, now);
        } catch (error) {
          result.failedUsers += 1;
          this.logger.log(LogLevel.ERROR, 'Notification user failed', {
            error: error instanceof Error ? error.message : 'unknown',
            module: 'NotificationTickService',
          });
        }
      }
    }
  }

  private async resolveTarget(user: DueNotificationUser): Promise<Target> {
    const families = await this.getUserFamilyAccessUseCase.execute(user.preferences.userId);
    const active = families.filter(
      (family) => !family.archived && !user.disabledFamilyIds.has(family.familyId),
    );
    const owners = new Map<string, { owner: OwnerType; ownerId: string }>([
      [
        ownerKey(OwnerType.USER, user.preferences.userId),
        { owner: OwnerType.USER, ownerId: user.preferences.userId },
      ],
    ]);

    for (const family of active) {
      owners.set(ownerKey(OwnerType.FAMILY, family.familyId), {
        owner: OwnerType.FAMILY,
        ownerId: family.familyId,
      });
    }

    return {
      ownerNames: Object.fromEntries(active.map((family) => [family.familyId, family.name])),
      owners,
      user,
    };
  }

  // One read per module for the union of the owners of every user of this local date; `undefined` = a module failed and
  // those users wait for the next tick.
  private async collect(
    localDate: string,
    group: Target[],
    rethrow = false,
  ): Promise<NotificationItemInput[] | undefined> {
    const owners = new Map<string, { owner: OwnerType; ownerId: string }>();
    const ownerNames: Record<string, string> = {};

    for (const target of group) {
      target.owners.forEach((owner, key) => owners.set(key, owner));
      Object.assign(ownerNames, target.ownerNames);
    }

    const request = { localDate, ownerNames, owners: [...owners.values()] };
    const collectors: INoticeCollector[] = [this.stockNoticeCollector, this.financeNoticeCollector];

    try {
      const lists = await Promise.all(
        collectors.map(async (collector) => collector.collect(request)),
      );

      return lists.flat();
    } catch (error) {
      if (rethrow) {
        throw error;
      }

      this.logger.log(LogLevel.ERROR, 'Notification collector failed', {
        error: error instanceof Error ? error.message : 'unknown',
        module: 'NotificationTickService',
      });

      return undefined;
    }
  }

  // The collected rows narrowed to ONE user: owners, enabled types and lead days (FR 2, 10, 36).
  private itemsFor(
    target: Target,
    collected: NotificationItemInput[],
    localDate: string,
  ): NotificationItemInput[] {
    const { preferences } = target.user;

    return filterItemsForUser(collected, {
      allowedOwnerKeys: new Set(target.owners.keys()),
      disabledTypes: preferences.disabledTypes,
      leadDays: {
        FINANCE_BILL_DUE: preferences.billLeadDays,
        FINANCE_INVOICE_DUE: preferences.invoiceLeadDays,
      },
      localDate,
    });
  }

  private async notify(
    mode: Mode,
    target: Target,
    collected: NotificationItemInput[],
    localDate: string,
    now: Date,
  ): Promise<number> {
    const { preferences } = target.user;
    const items = this.itemsFor(target, collected, localDate);

    if (mode === 'summary') {
      const notice = await this.createSummaryNoticeUseCase.execute({ items, now, preferences });

      return notice ? 1 : 0;
    }

    return this.createUrgentNoticesUseCase.execute({ candidates: items, now, preferences });
  }
}
