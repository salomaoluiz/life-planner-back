import { ActivityEntry, ActivityEntryItem, Prisma } from '@db/client';

export interface ActivityBatchAggregate {
  bookingFrom: Date | null;
  bookingTo: Date | null;
  count: number;
  sources: string[];
  totals: { amount: bigint; currency: string }[];
}
export type ActivityEntryRow = ActivityEntry;
export type ActivityItemRow = ActivityEntryItem;
export interface IActivityDatasource {
  aggregateItems(entryId: string): Promise<ActivityBatchAggregate>;
  deleteByOwner(owner: ActivityEntry['owner'], ownerId: string): Promise<number>;
  deleteOlderThan(cutoff: Date): Promise<number>;
  // `type:id` keys that still exist; one `findMany` per type in `refs`.
  existing(refs: Map<ActivityEntryItem['entity_type'], string[]>): Promise<Set<string>>;
  findEntry(id: string, owners: Prisma.ActivityEntryWhereInput[]): Promise<ActivityEntry | null>;
  findItems(where: Prisma.ActivityEntryItemWhereInput, take: number): Promise<ActivityEntryItem[]>;
  findPage(where: Prisma.ActivityEntryWhereInput, take: number): Promise<ActivityEntry[]>;
  // Every `(entity_type, entity_id)` of a batch, for the "still exist" count of its header.
  findItemRefs(entryId: string): Promise<Pick<ActivityEntryItem, 'entity_id' | 'entity_type'>[]>;
  insert(
    entry: Prisma.ActivityEntryUncheckedCreateInput,
    items: Prisma.ActivityEntryItemCreateManyInput[],
  ): Promise<void>;
}
