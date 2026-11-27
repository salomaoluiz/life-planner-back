import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityEntityType } from '@activity/domain/enum';

export type IActivitySnapshotRepository = {
  // The item as it is now (null when it is gone); `entityType` must be a readable one (not TRANSACTION_IMPORT).
  read(entityType: ActivityEntityType, id: string): Promise<ActivitySnapshot | null>;
};
