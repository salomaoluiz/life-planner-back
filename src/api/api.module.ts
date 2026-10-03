import { Module } from '@nestjs/common';

import { AuthAPIModule } from '@api/auth/auth.module';
import { UserAPIModule } from '@api/user/user.module';

import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, AuthAPIModule, UserAPIModule],
})
export class ApiModule {}
