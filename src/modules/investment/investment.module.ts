import { Module } from '@nestjs/common';

import { InvestmentDatasource } from '@investment/data/datasource/InvestmentDatasource';
import { InvestmentRepository } from '@investment/data/repository/InvestmentRepository';

// Use cases are added to `useCases` and exported as they are built (tasks B4-B6).
const useCases: never[] = [];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IInvestmentRepository', useClass: InvestmentRepository },
    { provide: 'IInvestmentDatasource', useClass: InvestmentDatasource },
  ],
})
export class InvestmentModule {}
