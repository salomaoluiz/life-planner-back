import {
  NotificationItemState,
  NotificationModule,
  NotificationType,
} from '@notification/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 124 FR 20: what the center shows without reading stock or finance.
export interface NotificationSnapshot {
  accountName?: string;
  cardName?: string;
  currency?: string;
  description: string;
  location?: string;
  ownerName?: string;
  quantity?: number;
  unit?: string;
  valueCents?: number;
}

// What a collector hands to the service (FR 30): the service knows nothing about stock or finance.
export interface NotificationItem extends NotificationItemInput {
  dedupeKey: string;
  position: number;
}
export interface NotificationItemInput {
  dueDate: string;
  module: NotificationModule;
  owner: OwnerType;
  ownerId: string;
  route: string;
  snapshot: NotificationSnapshot;
  sourceId: string;
  state: NotificationItemState;
  type: NotificationType;
}

// FR 5: `<type>:<sourceId>:<dueDate>`; a changed date makes a new key.
export function dedupeKeyOf(
  item: Pick<NotificationItemInput, 'dueDate' | 'sourceId' | 'type'>,
): string {
  return `${item.type}:${item.sourceId}:${item.dueDate}`;
}
