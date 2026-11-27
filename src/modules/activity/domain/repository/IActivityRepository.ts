import {
  ActivityEntryEntity,
  ActivityListFilter,
  ActivityPage,
  BatchItemsPage,
  BatchItemsQuery,
  EntityRefs,
  NewActivityEntry,
} from '@activity/domain/entity/ActivityEntry';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IActivityRepository = {
  // Retention (FR 13): entries older than `cutoff`; their items cascade. Returns the entries deleted.
  deleteOlderThan(cutoff: Date): Promise<number>;
  // FR 14, 15: every entry of one owner (account or family deletion).
  deleteByOwner(owner: OwnerType, ownerId: string): Promise<number>;
  // FR 10: `type:id` of every ref that still exists, at most one query per entity type.
  existingRefs(refs: EntityRefs): Promise<Set<string>>;
  // FR 8: one entry and its items (chunks of 500) through the ambient transaction.
  insert(entry: NewActivityEntry): Promise<void>;
  // FR 9: `pageSize + 1` rows at most, newest first.
  list(filter: ActivityListFilter, pageSize: number): Promise<ActivityPage>;
  // FR 11: the entry readable by one of `owners` or null.
  findEntry(
    id: string,
    owners: { ownerId: string; ownerType: OwnerType }[],
  ): Promise<ActivityEntryEntity | null>;
  listItems(query: BatchItemsQuery, pageSize: number, withHeader: boolean): Promise<BatchItemsPage>;
};
