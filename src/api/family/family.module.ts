import { Module } from '@nestjs/common';

import { FAMILY_OWNED_RECORDS_CHECKS } from '@api/family/v1/family-records-checks';
import { FamilyController } from '@api/family/v1/family.controller';
import { FamilyService } from '@api/family/v1/family.service';
import { FamilyModule } from '@family/family.module';
import { HasFinanceDataByOwnerUseCase } from '@finance/application/use-case/HasFinanceDataByOwnerUseCase';
import { FinanceModule } from '@finance/finance.module';
import { HasStockItemsByOwnerUseCase } from '@stock/application/use-case/HasStockItemsByOwnerUseCase';
import { StockModule } from '@stock/stock.module';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [FamilyController],
  imports: [FamilyModule, FinanceModule, StockModule, UserModule],
  providers: [
    FamilyService,
    {
      // One "does the family still own records?" check per owned module (409 on family delete).
      inject: [HasFinanceDataByOwnerUseCase, HasStockItemsByOwnerUseCase],
      provide: FAMILY_OWNED_RECORDS_CHECKS,
      useFactory: (
        hasFinanceData: HasFinanceDataByOwnerUseCase,
        hasStockItems: HasStockItemsByOwnerUseCase,
      ) => [hasFinanceData, hasStockItems],
    },
  ],
})
export class FamilyAPIModule {}
