import { Module } from '@nestjs/common';

import { AdjustAccountBalanceUseCase } from '@finance/application/use-case/AdjustAccountBalanceUseCase';
import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { CreateAccountUseCase } from '@finance/application/use-case/CreateAccountUseCase';
import { CreateCardEarlyPaymentUseCase } from '@finance/application/use-case/CreateCardEarlyPaymentUseCase';
import { CreateCardRefundUseCase } from '@finance/application/use-case/CreateCardRefundUseCase';
import { CreateCategoryUseCase } from '@finance/application/use-case/CreateCategoryUseCase';
import { CreateCreditCardUseCase } from '@finance/application/use-case/CreateCreditCardUseCase';
import { CreateInstallmentPlanUseCase } from '@finance/application/use-case/CreateInstallmentPlanUseCase';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteAccountUseCase } from '@finance/application/use-case/DeleteAccountUseCase';
import { DeleteCardEarlyPaymentUseCase } from '@finance/application/use-case/DeleteCardEarlyPaymentUseCase';
import { DeleteCardRefundUseCase } from '@finance/application/use-case/DeleteCardRefundUseCase';
import { DeleteCategoryUseCase } from '@finance/application/use-case/DeleteCategoryUseCase';
import { DeleteCreditCardUseCase } from '@finance/application/use-case/DeleteCreditCardUseCase';
import { DeleteFinanceDataByOwnerUseCase } from '@finance/application/use-case/DeleteFinanceDataByOwnerUseCase';
import { DeleteInstallmentPlanUseCase } from '@finance/application/use-case/DeleteInstallmentPlanUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { GetAccountsUseCase } from '@finance/application/use-case/GetAccountsUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { GetCreditCardByIdUseCase } from '@finance/application/use-case/GetCreditCardByIdUseCase';
import { GetCreditCardsOverviewUseCase } from '@finance/application/use-case/GetCreditCardsOverviewUseCase';
import { GetCreditCardsUseCase } from '@finance/application/use-case/GetCreditCardsUseCase';
import { GetInstallmentPlanUseCase } from '@finance/application/use-case/GetInstallmentPlanUseCase';
import { GetInvoicesForListUseCase } from '@finance/application/use-case/GetInvoicesForListUseCase';
import { GetInvoiceUseCase } from '@finance/application/use-case/GetInvoiceUseCase';
import { GetPrepaymentPreviewUseCase } from '@finance/application/use-case/GetPrepaymentPreviewUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { HasFinanceDataByOwnerUseCase } from '@finance/application/use-case/HasFinanceDataByOwnerUseCase';
import { PayInvoiceUseCase } from '@finance/application/use-case/PayInvoiceUseCase';
import { PrepayInstallmentPlanUseCase } from '@finance/application/use-case/PrepayInstallmentPlanUseCase';
import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import { ResolveRefundLinkUseCase } from '@finance/application/use-case/ResolveRefundLinkUseCase';
import { UndoInstallmentPrepaymentUseCase } from '@finance/application/use-case/UndoInstallmentPrepaymentUseCase';
import { UndoInvoicePaymentUseCase } from '@finance/application/use-case/UndoInvoicePaymentUseCase';
import { UpdateAccountUseCase } from '@finance/application/use-case/UpdateAccountUseCase';
import { UpdateCardEarlyPaymentUseCase } from '@finance/application/use-case/UpdateCardEarlyPaymentUseCase';
import { UpdateCardRefundUseCase } from '@finance/application/use-case/UpdateCardRefundUseCase';
import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import { UpdateCreditCardUseCase } from '@finance/application/use-case/UpdateCreditCardUseCase';
import { UpdateInstallmentPlanUseCase } from '@finance/application/use-case/UpdateInstallmentPlanUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import { FinanceAccountDatasource } from '@finance/data/datasource/FinanceAccountDatasource';
import { FinanceCardCreditDatasource } from '@finance/data/datasource/FinanceCardCreditDatasource';
import { FinanceCategoryDatasource } from '@finance/data/datasource/FinanceCategoryDatasource';
import { FinanceCreditCardDatasource } from '@finance/data/datasource/FinanceCreditCardDatasource';
import { FinanceInstallmentPlanDatasource } from '@finance/data/datasource/FinanceInstallmentPlanDatasource';
import { FinanceInvoicePaymentDatasource } from '@finance/data/datasource/FinanceInvoicePaymentDatasource';
import { FinanceOwnerDataDatasource } from '@finance/data/datasource/FinanceOwnerDataDatasource';
import { FinancePrepaymentDatasource } from '@finance/data/datasource/FinancePrepaymentDatasource';
import { FinanceTransactionDatasource } from '@finance/data/datasource/FinanceTransactionDatasource';
import { FinanceAccountRepository } from '@finance/data/repository/FinanceAccountRepository';
import { FinanceCardCreditRepository } from '@finance/data/repository/FinanceCardCreditRepository';
import { FinanceCategoryRepository } from '@finance/data/repository/FinanceCategoryRepository';
import { FinanceCreditCardRepository } from '@finance/data/repository/FinanceCreditCardRepository';
import { FinanceInstallmentPlanRepository } from '@finance/data/repository/FinanceInstallmentPlanRepository';
import { FinanceInvoicePaymentRepository } from '@finance/data/repository/FinanceInvoicePaymentRepository';
import { FinanceOwnerDataRepository } from '@finance/data/repository/FinanceOwnerDataRepository';
import { FinancePrepaymentRepository } from '@finance/data/repository/FinancePrepaymentRepository';
import { FinanceTransactionRepository } from '@finance/data/repository/FinanceTransactionRepository';

const useCases = [
  CreateCardEarlyPaymentUseCase,
  CreateCardRefundUseCase,
  DeleteCardEarlyPaymentUseCase,
  DeleteCardRefundUseCase,
  ResolveRefundLinkUseCase,
  UpdateCardEarlyPaymentUseCase,
  UpdateCardRefundUseCase,
  CreateInstallmentPlanUseCase,
  DeleteInstallmentPlanUseCase,
  GetInstallmentPlanUseCase,
  UpdateInstallmentPlanUseCase,
  AdjustAccountBalanceUseCase,
  AttachAccountBalancesUseCase,
  ComputeCardInvoicesUseCase,
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
  GetInvoicesForListUseCase,
  GetInvoiceUseCase,
  GetPrepaymentPreviewUseCase,
  GetTransactionsUseCase,
  HasFinanceDataByOwnerUseCase,
  PayInvoiceUseCase,
  PrepayInstallmentPlanUseCase,
  ResolveCardRowsPaidUseCase,
  UndoInstallmentPrepaymentUseCase,
  UndoInvoicePaymentUseCase,
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
    { provide: 'IFinanceCardCreditRepository', useClass: FinanceCardCreditRepository },
    { provide: 'IFinanceCardCreditDatasource', useClass: FinanceCardCreditDatasource },
    { provide: 'IFinanceCategoryRepository', useClass: FinanceCategoryRepository },
    { provide: 'IFinanceCategoryDatasource', useClass: FinanceCategoryDatasource },
    { provide: 'IFinanceCreditCardRepository', useClass: FinanceCreditCardRepository },
    { provide: 'IFinanceCreditCardDatasource', useClass: FinanceCreditCardDatasource },
    { provide: 'IFinanceInstallmentPlanRepository', useClass: FinanceInstallmentPlanRepository },
    { provide: 'IFinanceInstallmentPlanDatasource', useClass: FinanceInstallmentPlanDatasource },
    { provide: 'IFinanceInvoicePaymentRepository', useClass: FinanceInvoicePaymentRepository },
    { provide: 'IFinanceInvoicePaymentDatasource', useClass: FinanceInvoicePaymentDatasource },
    { provide: 'IFinanceOwnerDataRepository', useClass: FinanceOwnerDataRepository },
    { provide: 'IFinanceOwnerDataDatasource', useClass: FinanceOwnerDataDatasource },
    { provide: 'IFinancePrepaymentRepository', useClass: FinancePrepaymentRepository },
    { provide: 'IFinancePrepaymentDatasource', useClass: FinancePrepaymentDatasource },
    { provide: 'IFinanceTransactionRepository', useClass: FinanceTransactionRepository },
    { provide: 'IFinanceTransactionDatasource', useClass: FinanceTransactionDatasource },
  ],
})
export class FinanceModule {}
