import { Module } from '@nestjs/common';

import { CreateAccountUseCase } from '@finance/application/use-case/CreateAccountUseCase';
import { CreateCategoryUseCase } from '@finance/application/use-case/CreateCategoryUseCase';
import { CreateCreditCardUseCase } from '@finance/application/use-case/CreateCreditCardUseCase';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteAccountUseCase } from '@finance/application/use-case/DeleteAccountUseCase';
import { DeleteCategoryUseCase } from '@finance/application/use-case/DeleteCategoryUseCase';
import { DeleteCreditCardUseCase } from '@finance/application/use-case/DeleteCreditCardUseCase';
import { DeleteFinanceDataByOwnerUseCase } from '@finance/application/use-case/DeleteFinanceDataByOwnerUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { GetAccountsUseCase } from '@finance/application/use-case/GetAccountsUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { GetCreditCardByIdUseCase } from '@finance/application/use-case/GetCreditCardByIdUseCase';
import { GetCreditCardsOverviewUseCase } from '@finance/application/use-case/GetCreditCardsOverviewUseCase';
import { GetCreditCardsUseCase } from '@finance/application/use-case/GetCreditCardsUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { HasFinanceDataByOwnerUseCase } from '@finance/application/use-case/HasFinanceDataByOwnerUseCase';
import { UpdateAccountUseCase } from '@finance/application/use-case/UpdateAccountUseCase';
import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import { UpdateCreditCardUseCase } from '@finance/application/use-case/UpdateCreditCardUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import { FinanceAccountDatasource } from '@finance/data/datasource/FinanceAccountDatasource';
import { FinanceCategoryDatasource } from '@finance/data/datasource/FinanceCategoryDatasource';
import { FinanceCreditCardDatasource } from '@finance/data/datasource/FinanceCreditCardDatasource';
import { FinanceOwnerDataDatasource } from '@finance/data/datasource/FinanceOwnerDataDatasource';
import { FinanceTransactionDatasource } from '@finance/data/datasource/FinanceTransactionDatasource';
import { FinanceAccountRepository } from '@finance/data/repository/FinanceAccountRepository';
import { FinanceCategoryRepository } from '@finance/data/repository/FinanceCategoryRepository';
import { FinanceCreditCardRepository } from '@finance/data/repository/FinanceCreditCardRepository';
import { FinanceOwnerDataRepository } from '@finance/data/repository/FinanceOwnerDataRepository';
import { FinanceTransactionRepository } from '@finance/data/repository/FinanceTransactionRepository';

const useCases = [
  CreateAccountUseCase,
  CreateCategoryUseCase,
  CreateCreditCardUseCase,
  CreateTransactionUseCase,
  DeleteAccountUseCase,
  DeleteCategoryUseCase,
  DeleteCreditCardUseCase,
  DeleteFinanceDataByOwnerUseCase,
  DeleteTransactionUseCase,
  EnsureTransactionConsistencyUseCase,
  GetAccountsUseCase,
  GetCategoriesUseCase,
  GetCreditCardByIdUseCase,
  GetCreditCardsOverviewUseCase,
  GetCreditCardsUseCase,
  GetTransactionsUseCase,
  HasFinanceDataByOwnerUseCase,
  UpdateAccountUseCase,
  UpdateCategoryUseCase,
  UpdateCreditCardUseCase,
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
    { provide: 'IFinanceCreditCardRepository', useClass: FinanceCreditCardRepository },
    { provide: 'IFinanceCreditCardDatasource', useClass: FinanceCreditCardDatasource },
    { provide: 'IFinanceOwnerDataRepository', useClass: FinanceOwnerDataRepository },
    { provide: 'IFinanceOwnerDataDatasource', useClass: FinanceOwnerDataDatasource },
    { provide: 'IFinanceTransactionRepository', useClass: FinanceTransactionRepository },
    { provide: 'IFinanceTransactionDatasource', useClass: FinanceTransactionDatasource },
  ],
})
export class FinanceModule {}
