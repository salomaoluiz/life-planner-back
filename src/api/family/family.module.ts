import { Module } from '@nestjs/common';

import { FAMILY_OWNED_RECORDS_CHECKS } from '@api/family/v1/family-records-checks';
import { FamilyController } from '@api/family/v1/family.controller';
import { FamilyService } from '@api/family/v1/family.service';
import { FamilyModule } from '@family/family.module';
import { HasFinanceDataByOwnerUseCase } from '@finance/application/use-case/HasFinanceDataByOwnerUseCase';
import { FinanceModule } from '@finance/finance.module';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [FamilyController],
  imports: [FamilyModule, FinanceModule, UserModule],
  providers: [
    FamilyService,
    {
      // Spec 005 (stock) appends its own check to this list.
      inject: [HasFinanceDataByOwnerUseCase],
      provide: FAMILY_OWNED_RECORDS_CHECKS,
      useFactory: (hasFinanceData: HasFinanceDataByOwnerUseCase) => [hasFinanceData],
    },
  ],
})
export class FamilyAPIModule {}
