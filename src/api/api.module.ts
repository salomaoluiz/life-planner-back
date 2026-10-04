import { Module } from '@nestjs/common';

import { AuthAPIModule } from '@api/auth/auth.module';
import { FamilyMemberAPIModule } from '@api/family-member/family-member.module';
import { FamilyAPIModule } from '@api/family/family.module';
import { UserAPIModule } from '@api/user/user.module';

import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, AuthAPIModule, FamilyAPIModule, FamilyMemberAPIModule, UserAPIModule],
})
export class ApiModule {}
