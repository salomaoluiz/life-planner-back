import { Module } from '@nestjs/common';

import { CleanupActivityUseCase } from '@activity/application/use-case/CleanupActivityUseCase';
import { ListActivityItemsUseCase } from '@activity/application/use-case/ListActivityItemsUseCase';
import { ListActivityUseCase } from '@activity/application/use-case/ListActivityUseCase';
import { PurgeActivityByOwnerUseCase } from '@activity/application/use-case/PurgeActivityByOwnerUseCase';
import { ReadActivitySnapshotUseCase } from '@activity/application/use-case/ReadActivitySnapshotUseCase';
import { RecordActivityUseCase } from '@activity/application/use-case/RecordActivityUseCase';
import { ActivityDatasource } from '@activity/data/datasource/ActivityDatasource';
import { ActivitySnapshotDatasource } from '@activity/data/datasource/ActivitySnapshotDatasource';
import { ActivityRepository } from '@activity/data/repository/ActivityRepository';
import { ActivitySnapshotRepository } from '@activity/data/repository/ActivitySnapshotRepository';

// Spec 127: modules export use cases only. The recorder (interceptor) lives in `src/api/activity`.
const useCases = [
  CleanupActivityUseCase,
  ListActivityItemsUseCase,
  ListActivityUseCase,
  PurgeActivityByOwnerUseCase,
  ReadActivitySnapshotUseCase,
  RecordActivityUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    ActivitySnapshotDatasource,
    { provide: 'IActivitySnapshotRepository', useClass: ActivitySnapshotRepository },
    { provide: 'IActivityRepository', useClass: ActivityRepository },
    { provide: 'IActivityDatasource', useClass: ActivityDatasource },
  ],
})
export class ActivityModule {}
