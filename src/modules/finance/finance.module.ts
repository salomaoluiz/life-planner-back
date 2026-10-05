import { Module } from '@nestjs/common';

import { CreateAccountUseCase } from '@finance/application/use-case/CreateAccountUseCase';
import { CreateCategoryUseCase } from '@finance/application/use-case/CreateCategoryUseCase';
import { DeleteAccountUseCase } from '@finance/application/use-case/DeleteAccountUseCase';
import { DeleteCategoryUseCase } from '@finance/application/use-case/DeleteCategoryUseCase';
import { GetAccountsUseCase } from '@finance/application/use-case/GetAccountsUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { UpdateAccountUseCase } from '@finance/application/use-case/UpdateAccountUseCase';
import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import { FinanceAccountDatasource } from '@finance/data/datasource/FinanceAccountDatasource';
import { FinanceCategoryDatasource } from '@finance/data/datasource/FinanceCategoryDatasource';
import { FinanceAccountRepository } from '@finance/data/repository/FinanceAccountRepository';
import { FinanceCategoryRepository } from '@finance/data/repository/FinanceCategoryRepository';

const useCases = [
  CreateAccountUseCase,
  CreateCategoryUseCase,
  DeleteAccountUseCase,
  DeleteCategoryUseCase,
  GetAccountsUseCase,
  GetCategoriesUseCase,
  UpdateAccountUseCase,
  UpdateCategoryUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IFinanceAccountRepository', useClass: FinanceAccountRepository },
    { provide: 'IFinanceAccountDatasource', useClass: FinanceAccountDatasource },
    { provide: 'IFinanceCategoryRepository', useClass: FinanceCategoryRepository },
    { provide: 'IFinanceCategoryDatasource', useClass: FinanceCategoryDatasource },
  ],
})
export class FinanceModule {}
