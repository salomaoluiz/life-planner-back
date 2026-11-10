import { Module } from '@nestjs/common';

import { AccountDeletionService } from '@api/user/v1/account-deletion.service';
import { OWNED_RECORDS_PURGES, OwnedRecordsPurgeEntry } from '@api/user/v1/owned-records-purges';
import { UserController } from '@api/user/v1/user.controller';
import { UserService } from '@api/user/v1/user.service';
import { FamilyModule } from '@family/family.module';
import { DeleteFinanceDataByOwnerUseCase } from '@finance/application/use-case/DeleteFinanceDataByOwnerUseCase';
import { FinanceModule } from '@finance/finance.module';
import { DeleteInvestmentsByOwnerUseCase } from '@investment/application/use-case/DeleteInvestmentsByOwnerUseCase';
import { InvestmentModule } from '@investment/investment.module';
import { DeleteStockItemsByOwnerUseCase } from '@stock/application/use-case/DeleteStockItemsByOwnerUseCase';
import { StockModule } from '@stock/stock.module';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [UserController],
  imports: [FamilyModule, FinanceModule, InvestmentModule, StockModule, UserModule],
  providers: [
    AccountDeletionService,
    {
      // One "delete everything this owner holds" step per owned module. A new owned module appends its purge here.
      inject: [
        DeleteFinanceDataByOwnerUseCase,
        DeleteStockItemsByOwnerUseCase,
        DeleteInvestmentsByOwnerUseCase,
      ],
      provide: OWNED_RECORDS_PURGES,
      useFactory: (
        deleteFinanceData: DeleteFinanceDataByOwnerUseCase,
        deleteStockItems: DeleteStockItemsByOwnerUseCase,
        deleteInvestments: DeleteInvestmentsByOwnerUseCase,
      ): OwnedRecordsPurgeEntry[] => [
        { module: 'finance', purge: deleteFinanceData },
        { module: 'stock', purge: deleteStockItems },
        { module: 'investment', purge: deleteInvestments },
      ],
    },
    UserService,
  ],
})
export class UserAPIModule {}
