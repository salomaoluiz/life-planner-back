import { Module } from '@nestjs/common';

import { FAMILY_OWNED_RECORDS_CHECKS } from '@api/family/v1/family-records-checks';
import { FamilyController } from '@api/family/v1/family.controller';
import { FamilyService } from '@api/family/v1/family.service';
import { FamilyModule } from '@family/family.module';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [FamilyController],
  imports: [FamilyModule, UserModule],
  providers: [
    FamilyService,
    {
      // Specs 005/006: import their modules above and replace `useValue: []` with
      // `useFactory: (...checks) => checks, inject: [<HasStockByOwnerUseCase>, HasFinanceDataByOwnerUseCase]`.
      provide: FAMILY_OWNED_RECORDS_CHECKS,
      useValue: [],
    },
  ],
})
export class FamilyAPIModule {}
