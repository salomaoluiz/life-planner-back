import {
  ActivityAction,
  ActivityActionFilter,
  ActivityEntityType,
  ActivityModule,
} from '@activity/domain/enum';
import { ActivityChange } from '@activity/domain/service/ActivityDiff';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 127 FR 6: what is needed to read an entry later even if the item changed or was deleted.
export interface ActivityEntryEntity extends Omit<NewActivityEntry, 'items'> {
  batchPreview: { count: number; labels: string[] } | null;
  id: string;
}
export interface ActivityItemEntity extends ActivityItemInput {
  id: string;
}
export interface ActivityItemInput {
  action: ActivityAction;
  amountCents?: null | number;
  bookingDate?: null | string;
  currency?: null | string;
  entityId: string;
  entityType: ActivityEntityType;
  label: string;
  // Only for the before/after comparison of a batch (never stored): what changed besides the shown columns.
  signature?: string;
  sourceName?: null | string;
}
export interface ActivityListFilter {
  action?: ActivityActionFilter;
  actorId?: string;
  cursor?: { id: string; occurredAt: Date };
  from: Date;
  module: ActivityModule;
  owners: { ownerId: string; ownerType: OwnerType }[];
  q?: string;
  to: Date;
}
export interface ActivityPage {
  hasMore: boolean;
  rows: ActivityEntryEntity[];
}
export interface ActivitySummary {
  amountCents?: number;
  bookingDate?: string;
  currency?: string;
  extra?: Record<string, unknown>;
  label: string;
  ownerName: string;
  sources?: string[];
}
export interface BatchHeader {
  bookingFrom: null | string;
  bookingTo: null | string;
  count: number;
  sources: string[];
  totals: { amountCents: number; currency: string }[];
}
export interface BatchItemsPage {
  hasMore: boolean;
  header: BatchHeader | null;
  items: ActivityItemEntity[];
}
export interface BatchItemsQuery {
  cursor?: { bookingDate: null | string; id: string };
  entryId: string;
  q?: string;
}
export interface NewActivityEntry {
  action: ActivityAction;
  actorId: null | string;
  actorName: string;
  batch: boolean;
  changes: ActivityChange[] | null;
  entityId: null | string;
  entityType: ActivityEntityType;
  items: ActivityItemInput[];
  modules: ActivityModule[];
  occurredAt: Date;
  ownerId: string;
  ownerType: OwnerType;
  searchText: string;
  summary: ActivitySummary;
}

// `type:id` keys of the items that still exist, per `ActivityEntityType`.
export type EntityRefs = Map<ActivityEntityType, string[]>;
