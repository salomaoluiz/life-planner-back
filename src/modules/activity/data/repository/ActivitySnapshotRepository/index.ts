import { Injectable } from '@nestjs/common';

import { ActivitySnapshotDatasource } from '@activity/data/datasource/ActivitySnapshotDatasource';
import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityEntityType, ActivityGroupKind } from '@activity/domain/enum';
import { IActivitySnapshotRepository } from '@activity/domain/repository/IActivitySnapshotRepository';

@Injectable()
export class ActivitySnapshotRepository implements IActivitySnapshotRepository {
  constructor(private readonly datasource: ActivitySnapshotDatasource) {}

  async read(entityType: ActivityEntityType, id: string): Promise<ActivitySnapshot | null> {
    return this.datasource.read(entityType, id);
  }

  async readGroup(kind: ActivityGroupKind, id: string): Promise<ActivityItemInput[]> {
    return this.datasource.readGroup(kind, id);
  }
}
