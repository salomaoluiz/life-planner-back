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
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { HasFinanceDataByOwnerUseCase } from '@finance/application/use-case/HasFinanceDataByOwnerUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import { FinanceTransactionDatasource } from '@finance/data/datasource/FinanceTransactionDatasource';
import { FinanceTransactionRepository } from '@finance/data/repository/FinanceTransactionRepository';

const useCases = [
  CreateAccountUseCase,
  CreateCategoryUseCase,
  CreateTransactionUseCase,
  DeleteAccountUseCase,
  DeleteCategoryUseCase,
  DeleteTransactionUseCase,
  EnsureTransactionConsistencyUseCase,
  GetAccountsUseCase,
  GetCategoriesUseCase,
  GetTransactionsUseCase,
  HasFinanceDataByOwnerUseCase,
  UpdateAccountUseCase,
  UpdateCategoryUseCase,
  UpdateTransactionUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IFinanceAccountRepository', useClass: FinanceAccountRepository },
    { provide: 'IFinanceAccountDatasource', useClass: FinanceAccountDatasource },
    { provide: 'IFinanceCategoryRepository', useClass: FinanceCategoryRepository },
    { provide: 'IFinanceCategoryDatasource', useClass: FinanceCategoryDatasource },
    { provide: 'IFinanceTransactionRepository', useClass: FinanceTransactionRepository },
    { provide: 'IFinanceTransactionDatasource', useClass: FinanceTransactionDatasource },
  ],
})
export class FinanceModule {}
