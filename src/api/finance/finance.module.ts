import { Module } from '@nestjs/common';

import { AccountController } from '@api/finance/v1/account.controller';
import { AccountService } from '@api/finance/v1/account.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { FamilyModule } from '@family/family.module';
import { FinanceModule } from '@finance/finance.module';

@Module({
  controllers: [AccountController],
  imports: [FamilyModule, FinanceModule],
  providers: [AccountService, FinanceAccessService],
})
export class FinanceAPIModule {}
