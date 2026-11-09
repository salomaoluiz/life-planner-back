import { Module } from '@nestjs/common';

import { AuthAPIModule } from '@api/auth/auth.module';
import { UserExistsCheckModule } from '@api/auth/user-exists-check.module';
import { FamilyMemberAPIModule } from '@api/family-member/family-member.module';
import { FamilyAPIModule } from '@api/family/family.module';
import { FinanceAPIModule } from '@api/finance/finance.module';
import { InvestmentAPIModule } from '@api/investment/investment.module';
import { StockAPIModule } from '@api/stock/stock.module';
import { UserAPIModule } from '@api/user/user.module';
import { VersionAPIModule } from '@api/version/version.module';

import { HealthModule } from './health/health.module';

@Module({
  imports: [
    HealthModule,
    AuthAPIModule,
    FamilyAPIModule,
    FamilyMemberAPIModule,
    FinanceAPIModule,
    InvestmentAPIModule,
    StockAPIModule,
    UserAPIModule,
    UserExistsCheckModule,
    VersionAPIModule,
  ],
})
export class ApiModule {}
