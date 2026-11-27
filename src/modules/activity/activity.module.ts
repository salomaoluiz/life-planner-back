import { Module } from '@nestjs/common';

import { ActivityReaderRegistry } from '@activity/application/service/ActivityReaderRegistry';
import { CleanupActivityUseCase } from '@activity/application/use-case/CleanupActivityUseCase';
import { ListActivityItemsUseCase } from '@activity/application/use-case/ListActivityItemsUseCase';
import { ListActivityUseCase } from '@activity/application/use-case/ListActivityUseCase';
import { PurgeActivityByOwnerUseCase } from '@activity/application/use-case/PurgeActivityByOwnerUseCase';
import { RecordActivityUseCase } from '@activity/application/use-case/RecordActivityUseCase';
import { ActivityDatasource } from '@activity/data/datasource/ActivityDatasource';
import { ActivityRepository } from '@activity/data/repository/ActivityRepository';

// Spec 127: modules export use cases only. The recorder (interceptor) lives in `src/api/activity`.
const useCases = [
  CleanupActivityUseCase,
  ListActivityItemsUseCase,
  ListActivityUseCase,
  PurgeActivityByOwnerUseCase,
  RecordActivityUseCase,
];

@Module({
  exports: [...useCases, ActivityReaderRegistry],
  providers: [
    ...useCases,
    ActivityReaderRegistry,
    { provide: 'IActivityRepository', useClass: ActivityRepository },
    { provide: 'IActivityDatasource', useClass: ActivityDatasource },
  ],
})
export class ActivityModule {}
