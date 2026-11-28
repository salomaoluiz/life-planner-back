import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityEntityType, ActivityGroupKind } from '@activity/domain/enum';

export type IActivitySnapshotRepository = {
  // The item as it is now (null when it is gone); `entityType` must be a readable one (not TRANSACTION_IMPORT).
  // The rows of a batch (a series, a plan, a split...) as they are now; ids that are gone are simply absent.
  read(entityType: ActivityEntityType, id: string): Promise<ActivitySnapshot | null>;
  readGroup(kind: ActivityGroupKind, id: string): Promise<ActivityItemInput[]>;
};
