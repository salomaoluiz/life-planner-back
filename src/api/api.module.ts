import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module';
import { V1Module } from './v1/v1.module';

@Module({
  imports: [HealthModule, V1Module],
})
export class ApiModule {}
