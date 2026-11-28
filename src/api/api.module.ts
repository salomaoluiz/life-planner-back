import { Module } from '@nestjs/common';

import { ActivityAPIModule } from '@api/activity/activity.module';
import { AuthAPIModule } from '@api/auth/auth.module';
import { UserExistsCheckModule } from '@api/auth/user-exists-check.module';
import { FamilyMemberAPIModule } from '@api/family-member/family-member.module';
import { FamilyAPIModule } from '@api/family/family.module';
import { ExternalProjectionModule } from '@api/finance/external-projection.module';
import { FinanceAPIModule } from '@api/finance/finance.module';
import { InvestmentAPIModule } from '@api/investment/investment.module';
import { NotificationAPIModule } from '@api/notification/notification.module';
import { StockAPIModule } from '@api/stock/stock.module';
import { UserAPIModule } from '@api/user/user.module';
import { VersionAPIModule } from '@api/version/version.module';

import { HealthModule } from './health/health.module';

@Module({
  imports: [
    HealthModule,
    ActivityAPIModule,
    ExternalProjectionModule,
    AuthAPIModule,
    FamilyAPIModule,
    FamilyMemberAPIModule,
    FinanceAPIModule,
    InvestmentAPIModule,
    NotificationAPIModule,
    StockAPIModule,
    UserAPIModule,
    UserExistsCheckModule,
    VersionAPIModule,
  ],
})
export class ApiModule {}
