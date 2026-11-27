import { Module } from '@nestjs/common';

import { ActivityModule } from '@activity/activity.module';
import { ActivityRetentionJob } from '@api/activity/job/ActivityRetentionJob';
import { ActivityController } from '@api/activity/v1/activity.controller';
import { ActivityService } from '@api/activity/v1/activity.service';
import { FamilyModule } from '@family/family.module';

// Spec 127: the entrance of the activity module (read routes, retention job). The API modules that decorate write
// routes with `@RecordsActivity` import `ActivityModule` and `UserModule` themselves (Nest builds the interceptor in
// the module of the controller that uses it).
@Module({
  controllers: [ActivityController],
  imports: [ActivityModule, FamilyModule],
  providers: [ActivityRetentionJob, ActivityService],
})
export class ActivityAPIModule {}
