import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { NotificationType } from '@notification/domain/enum';
import { addDaysToDate } from '@notification/domain/service/NotificationClock';

export interface NoticeFilterRules {
  // `<owner>:<ownerId>` of every owner the user is notified about (families turned off and archived already left out).
  allowedOwnerKeys: ReadonlySet<string>;
  disabledTypes: readonly NotificationType[];
  // Types with a lead window set by the user (FR 2: finance). Stock types carry the item's window and are not listed.
  leadDays: Partial<Record<NotificationType, number>>;
  localDate: string;
}

export function ownerKey(owner: string, ownerId: string): string {
  return `${owner}:${ownerId}`;
}

// Spec 124 FR 2, 10, 36: what of the collected items reaches ONE user: their owners, the types they left on and, for the
// types with lead days, only items due within the window (overdue ones always stay, collectors cap how late).
export function filterItemsForUser(
  items: NotificationItemInput[],
  rules: NoticeFilterRules,
): NotificationItemInput[] {
  return items.filter((item) => {
    if (!rules.allowedOwnerKeys.has(ownerKey(item.owner, item.ownerId))) {
      return false;
    }

    if (rules.disabledTypes.includes(item.type)) {
      return false;
    }

    const lead = rules.leadDays[item.type];

    return lead === undefined || item.dueDate <= addDaysToDate(rules.localDate, lead);
  });
}
