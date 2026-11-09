import { Module } from '@nestjs/common';

import { InvestmentController } from '@api/investment/v1/investment.controller';
import { InvestmentService } from '@api/investment/v1/investment.service';
import { FamilyModule } from '@family/family.module';
import { InvestmentModule } from '@investment/investment.module';

@Module({
  controllers: [InvestmentController],
  imports: [FamilyModule, InvestmentModule],
  providers: [InvestmentService],
})
export class InvestmentAPIModule {}
