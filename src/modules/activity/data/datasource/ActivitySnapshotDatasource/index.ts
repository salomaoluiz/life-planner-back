import { Injectable } from '@nestjs/common';

import { FINANCE_SNAPSHOTS } from '@activity/data/datasource/ActivitySnapshotDatasource/finance';
import { GROUP_READERS } from '@activity/data/datasource/ActivitySnapshotDatasource/groups';
import { SnapshotReader } from '@activity/data/datasource/ActivitySnapshotDatasource/helpers';
import { INVESTMENT_SNAPSHOTS } from '@activity/data/datasource/ActivitySnapshotDatasource/investment';
import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityEntityType, ActivityGroupKind } from '@activity/domain/enum';
import { Database } from '@shared/infra/db/Database';

const READERS: Partial<Record<ActivityEntityType, SnapshotReader>> = {
  ...FINANCE_SNAPSHOTS,
  ...INVESTMENT_SNAPSHOTS,
};

// Spec 127 FR 6, 7: a read-only projection of the item a write route touched, through the ambient transaction
// (`Database.client`) so the "before" is read under the same snapshot as the write. This is the one place where the
// activity module reads the finance and investment tables, so no module depends on another.
@Injectable()
export class ActivitySnapshotDatasource {
  constructor(private readonly db: Database) {}

  async read(entityType: ActivityEntityType, id: string): Promise<ActivitySnapshot | null> {
    const reader = READERS[entityType];

    if (!reader) {
      throw new Error(`No activity snapshot reader for ${entityType}`);
    }

    return reader(this.db.client, id);
  }

  async readGroup(kind: ActivityGroupKind, id: string): Promise<ActivityItemInput[]> {
    return GROUP_READERS[kind](this.db.client, id);
  }
}
