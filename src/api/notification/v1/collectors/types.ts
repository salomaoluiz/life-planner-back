import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface CollectRequest {
  // The user's local date (FR 8): items are classified against it.
  localDate: string;
  // Display name of each family (by id), for the snapshot.
  ownerNames: Record<string, string>;
  // The union of the owners of a page of users (FR 29), archived families already left out.
  owners: { owner: OwnerType; ownerId: string }[];
}

// Spec 124 FR 30: a module teaches the generic service its notice types with a collector. The service only sees items.
export interface INoticeCollector {
  collect(request: CollectRequest): Promise<NotificationItemInput[]>;
}

export function stateOf(date: string, today: string): NotificationItemInput['state'] {
  if (date < today) {
    return 'OVERDUE';
  }

  return date === today ? 'DUE_TODAY' : 'UPCOMING';
}
