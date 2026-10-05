import { Module } from '@nestjs/common';

import { AccountController } from '@api/finance/v1/account.controller';
import { AccountService } from '@api/finance/v1/account.service';
import { CategoryController } from '@api/finance/v1/category.controller';
import { CategoryService } from '@api/finance/v1/category.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { FamilyModule } from '@family/family.module';
import { FinanceModule } from '@finance/finance.module';

@Module({
  controllers: [AccountController, CategoryController],
  imports: [FamilyModule, FinanceModule],
  providers: [AccountService, CategoryService, FinanceAccessService],
})
export class FinanceAPIModule {}
