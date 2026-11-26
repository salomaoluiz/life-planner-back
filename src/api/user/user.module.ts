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
import { DeleteNotificationsByUserUseCase } from '@notification/application/use-case/DeleteNotificationsByUserUseCase';
import { NotificationModule } from '@notification/notification.module';
import { DeleteStockItemsByOwnerUseCase } from '@stock/application/use-case/DeleteStockItemsByOwnerUseCase';
import { StockModule } from '@stock/stock.module';
import { UserModule } from '@user/user.module';

@Module({
  controllers: [UserController],
  imports: [
    FamilyModule,
    FinanceModule,
    InvestmentModule,
    NotificationModule,
    StockModule,
    UserModule,
  ],
  providers: [
    AccountDeletionService,
    {
      // One "delete everything this owner holds" step per owned module. A new owned module appends its purge here.
      inject: [
        DeleteFinanceDataByOwnerUseCase,
        DeleteStockItemsByOwnerUseCase,
        DeleteInvestmentsByOwnerUseCase,
        DeleteNotificationsByUserUseCase,
      ],
      provide: OWNED_RECORDS_PURGES,
      useFactory: (
        deleteFinanceData: DeleteFinanceDataByOwnerUseCase,
        deleteStockItems: DeleteStockItemsByOwnerUseCase,
        deleteInvestments: DeleteInvestmentsByOwnerUseCase,
        deleteNotifications: DeleteNotificationsByUserUseCase,
      ): OwnedRecordsPurgeEntry[] => [
        { module: 'finance', purge: deleteFinanceData },
        { module: 'stock', purge: deleteStockItems },
        { module: 'investment', purge: deleteInvestments },
        { module: 'notification', purge: deleteNotifications },
      ],
    },
    UserService,
  ],
})
export class UserAPIModule {}
