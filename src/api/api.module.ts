import { Module } from '@nestjs/common';

import { AuthAPIModule } from '@api/auth/auth.module';
import { FamilyAPIModule } from '@api/family/family.module';
import { FinanceAPIModule } from '@api/finance/finance.module';
import { StockAPIModule } from '@api/stock/stock.module';
import { UserAPIModule } from '@api/user/user.module';

import { HealthModule } from './health/health.module';

@Module({
  imports: [
    HealthModule,
    AuthAPIModule,
    FamilyAPIModule,
    FinanceAPIModule,
    StockAPIModule,
    UserAPIModule,
  ],
})
export class ApiModule {}
