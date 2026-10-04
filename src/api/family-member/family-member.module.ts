import { Module } from '@nestjs/common';

import { FamilyMemberController } from '@api/family-member/v1/family-member.controller';
import { FamilyMemberService } from '@api/family-member/v1/family-member.service';
import { FamilyModule } from '@family/family.module';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [FamilyMemberController],
  imports: [FamilyModule, UserModule],
  providers: [FamilyMemberService],
})
export class FamilyMemberAPIModule {}
