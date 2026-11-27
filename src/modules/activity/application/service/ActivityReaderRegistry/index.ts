import { Injectable } from '@nestjs/common';

import { ActivitySnapshotReader } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityEntityType } from '@activity/domain/enum';

// The modules register their readers at start-up, so `activity` depends on none of them.
@Injectable()
export class ActivityReaderRegistry {
  private readonly readers = new Map<ActivityEntityType, ActivitySnapshotReader>();

  get(entityType: ActivityEntityType): ActivitySnapshotReader | undefined {
    return this.readers.get(entityType);
  }

  register(...readers: ActivitySnapshotReader[]): void {
    readers.forEach((reader) => this.readers.set(reader.entityType, reader));
  }
}
