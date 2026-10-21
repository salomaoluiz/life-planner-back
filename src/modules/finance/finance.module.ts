import { Module } from '@nestjs/common';

import { AddFamilyToCategoryScopesUseCase } from '@finance/application/use-case/AddFamilyToCategoryScopesUseCase';
import { AddFamilyToTagScopesUseCase } from '@finance/application/use-case/AddFamilyToTagScopesUseCase';
import { AdjustAccountBalanceUseCase } from '@finance/application/use-case/AdjustAccountBalanceUseCase';
import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { CountExportTransactionsUseCase } from '@finance/application/use-case/CountExportTransactionsUseCase';
import { CreateAccountUseCase } from '@finance/application/use-case/CreateAccountUseCase';
import { CreateCardEarlyPaymentUseCase } from '@finance/application/use-case/CreateCardEarlyPaymentUseCase';
import { CreateCardRefundUseCase } from '@finance/application/use-case/CreateCardRefundUseCase';
import { CreateCategoryUseCase } from '@finance/application/use-case/CreateCategoryUseCase';
import { CreateCreditCardUseCase } from '@finance/application/use-case/CreateCreditCardUseCase';
import { CreateInstallmentPlanUseCase } from '@finance/application/use-case/CreateInstallmentPlanUseCase';
import { CreateRecurrenceUseCase } from '@finance/application/use-case/CreateRecurrenceUseCase';
import { CreateTagUseCase } from '@finance/application/use-case/CreateTagUseCase';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteAccountUseCase } from '@finance/application/use-case/DeleteAccountUseCase';
import { DeleteCardEarlyPaymentUseCase } from '@finance/application/use-case/DeleteCardEarlyPaymentUseCase';
import { DeleteCardRefundUseCase } from '@finance/application/use-case/DeleteCardRefundUseCase';
import { DeleteCategoryUseCase } from '@finance/application/use-case/DeleteCategoryUseCase';
import { DeleteCreditCardUseCase } from '@finance/application/use-case/DeleteCreditCardUseCase';
import { DeleteFinanceDataByOwnerUseCase } from '@finance/application/use-case/DeleteFinanceDataByOwnerUseCase';
import { DeleteInstallmentPlanUseCase } from '@finance/application/use-case/DeleteInstallmentPlanUseCase';
import { DeleteOccurrenceUseCase } from '@finance/application/use-case/DeleteOccurrenceUseCase';
import { DeleteRecurrenceUseCase } from '@finance/application/use-case/DeleteRecurrenceUseCase';
import { DeleteTagUseCase } from '@finance/application/use-case/DeleteTagUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { DetachCategoryCreatorFromFamilyUseCase } from '@finance/application/use-case/DetachCategoryCreatorFromFamilyUseCase';
import { DetachTagCreatorFromFamilyUseCase } from '@finance/application/use-case/DetachTagCreatorFromFamilyUseCase';
import { EndRecurrencesBySourceUseCase } from '@finance/application/use-case/EndRecurrencesBySourceUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { ExportTransactionsUseCase } from '@finance/application/use-case/ExportTransactionsUseCase';
import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { GetAccountsByIdsUseCase } from '@finance/application/use-case/GetAccountsByIdsUseCase';
import { GetAccountsUseCase } from '@finance/application/use-case/GetAccountsUseCase';
import { GetBalanceSeriesUseCase } from '@finance/application/use-case/GetBalanceSeriesUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { GetCategoryArchiveBlockersUseCase } from '@finance/application/use-case/GetCategoryArchiveBlockersUseCase';
import { GetCreditCardByIdUseCase } from '@finance/application/use-case/GetCreditCardByIdUseCase';
import { GetCreditCardsOverviewUseCase } from '@finance/application/use-case/GetCreditCardsOverviewUseCase';
import { GetCreditCardsUseCase } from '@finance/application/use-case/GetCreditCardsUseCase';
import { GetDailyBalancesUseCase } from '@finance/application/use-case/GetDailyBalancesUseCase';
import { GetDashboardRowsUseCase } from '@finance/application/use-case/GetDashboardRowsUseCase';
import { GetDashboardSummaryUseCase } from '@finance/application/use-case/GetDashboardSummaryUseCase';
import { GetFamilyArchiveBlockersUseCase } from '@finance/application/use-case/GetFamilyArchiveBlockersUseCase';
import { GetFinanceTotalsUseCase } from '@finance/application/use-case/GetFinanceTotalsUseCase';
import { GetInstallmentPlanUseCase } from '@finance/application/use-case/GetInstallmentPlanUseCase';
import { GetInvoicesForListUseCase } from '@finance/application/use-case/GetInvoicesForListUseCase';
import { GetInvoiceUseCase } from '@finance/application/use-case/GetInvoiceUseCase';
import { GetPrepaymentPreviewUseCase } from '@finance/application/use-case/GetPrepaymentPreviewUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { GetRecurrencesUseCase } from '@finance/application/use-case/GetRecurrencesUseCase';
import { GetRecurrenceUseCase } from '@finance/application/use-case/GetRecurrenceUseCase';
import { GetTagsUseCase } from '@finance/application/use-case/GetTagsUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { HasFinanceDataByOwnerUseCase } from '@finance/application/use-case/HasFinanceDataByOwnerUseCase';
import { MaterializeOccurrenceUseCase } from '@finance/application/use-case/MaterializeOccurrenceUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { PayInvoiceUseCase } from '@finance/application/use-case/PayInvoiceUseCase';
import { PrepayInstallmentPlanUseCase } from '@finance/application/use-case/PrepayInstallmentPlanUseCase';
import { RemoveFamilyFromCategoryScopesUseCase } from '@finance/application/use-case/RemoveFamilyFromCategoryScopesUseCase';
import { RemoveFamilyFromTagScopesUseCase } from '@finance/application/use-case/RemoveFamilyFromTagScopesUseCase';
import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import { ResolveRefundLinkUseCase } from '@finance/application/use-case/ResolveRefundLinkUseCase';
import { SplitRecurrenceUseCase } from '@finance/application/use-case/SplitRecurrenceUseCase';
import { UndoInstallmentPrepaymentUseCase } from '@finance/application/use-case/UndoInstallmentPrepaymentUseCase';
import { UndoInvoicePaymentUseCase } from '@finance/application/use-case/UndoInvoicePaymentUseCase';
import { UpdateAccountUseCase } from '@finance/application/use-case/UpdateAccountUseCase';
import { UpdateCardEarlyPaymentUseCase } from '@finance/application/use-case/UpdateCardEarlyPaymentUseCase';
import { UpdateCardRefundUseCase } from '@finance/application/use-case/UpdateCardRefundUseCase';
import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import { UpdateCreditCardUseCase } from '@finance/application/use-case/UpdateCreditCardUseCase';
import { UpdateInstallmentPlanUseCase } from '@finance/application/use-case/UpdateInstallmentPlanUseCase';
import { UpdateRecurrenceUseCase } from '@finance/application/use-case/UpdateRecurrenceUseCase';
import { UpdateTagUseCase } from '@finance/application/use-case/UpdateTagUseCase';
import { UpdateTransactionUseCase } from '@finance/application/use-case/UpdateTransactionUseCase';
import { FinanceAccountDatasource } from '@finance/data/datasource/FinanceAccountDatasource';
import { FinanceCardCreditDatasource } from '@finance/data/datasource/FinanceCardCreditDatasource';
import { FinanceCategoryDatasource } from '@finance/data/datasource/FinanceCategoryDatasource';
import { FinanceCreditCardDatasource } from '@finance/data/datasource/FinanceCreditCardDatasource';
import { FinanceInstallmentPlanDatasource } from '@finance/data/datasource/FinanceInstallmentPlanDatasource';
import { FinanceInvoicePaymentDatasource } from '@finance/data/datasource/FinanceInvoicePaymentDatasource';
import { FinanceOwnerDataDatasource } from '@finance/data/datasource/FinanceOwnerDataDatasource';
import { FinancePrepaymentDatasource } from '@finance/data/datasource/FinancePrepaymentDatasource';
import { FinanceRecurrenceDatasource } from '@finance/data/datasource/FinanceRecurrenceDatasource';
import { FinanceTagDatasource } from '@finance/data/datasource/FinanceTagDatasource';
import { FinanceTransactionDatasource } from '@finance/data/datasource/FinanceTransactionDatasource';
import { FinanceAccountRepository } from '@finance/data/repository/FinanceAccountRepository';
import { FinanceCardCreditRepository } from '@finance/data/repository/FinanceCardCreditRepository';
import { FinanceCategoryRepository } from '@finance/data/repository/FinanceCategoryRepository';
import { FinanceCreditCardRepository } from '@finance/data/repository/FinanceCreditCardRepository';
import { FinanceInstallmentPlanRepository } from '@finance/data/repository/FinanceInstallmentPlanRepository';
import { FinanceInvoicePaymentRepository } from '@finance/data/repository/FinanceInvoicePaymentRepository';
import { FinanceOwnerDataRepository } from '@finance/data/repository/FinanceOwnerDataRepository';
import { FinancePrepaymentRepository } from '@finance/data/repository/FinancePrepaymentRepository';
import { FinanceRecurrenceRepository } from '@finance/data/repository/FinanceRecurrenceRepository';
import { FinanceTagRepository } from '@finance/data/repository/FinanceTagRepository';
import { FinanceTransactionRepository } from '@finance/data/repository/FinanceTransactionRepository';

const useCases = [
  EndRecurrencesBySourceUseCase,
  DeleteOccurrenceUseCase,
  DeleteRecurrenceUseCase,
  MaterializeOccurrenceUseCase,
  SplitRecurrenceUseCase,
  UpdateRecurrenceUseCase,
  GetProjectionsUseCase,
  GetRecurrencesUseCase,
  GetRecurrenceUseCase,
  CreateRecurrenceUseCase,
  MaterializeRecurrencesUseCase,
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
  AddFamilyToCategoryScopesUseCase,
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
  DetachCategoryCreatorFromFamilyUseCase,
  EnsureTransactionConsistencyUseCase,
  GetAccountsUseCase,
  GetCategoriesUseCase,
  ExpandCategoryIdsUseCase,
  FindInvoicesInRangeUseCase,
  GetCategoryArchiveBlockersUseCase,
  GetFamilyArchiveBlockersUseCase,
  GetAccountsByIdsUseCase,
  GetCreditCardByIdUseCase,
  GetBalanceSeriesUseCase,
  GetDailyBalancesUseCase,
  GetDashboardRowsUseCase,
  GetDashboardSummaryUseCase,
  GetFinanceTotalsUseCase,
  GetCreditCardsOverviewUseCase,
  GetCreditCardsUseCase,
  GetInvoicesForListUseCase,
  GetInvoiceUseCase,
  GetPrepaymentPreviewUseCase,
  CountExportTransactionsUseCase,
  ExportTransactionsUseCase,
  GetTransactionsUseCase,
  HasFinanceDataByOwnerUseCase,
  PayInvoiceUseCase,
  PrepayInstallmentPlanUseCase,
  RemoveFamilyFromCategoryScopesUseCase,
  ResolveCardRowsPaidUseCase,
  UndoInstallmentPrepaymentUseCase,
  UndoInvoicePaymentUseCase,
  UpdateAccountUseCase,
  UpdateCategoryUseCase,
  UpdateCreditCardUseCase,
  UpdateTransactionUseCase,
  AddFamilyToTagScopesUseCase,
  CreateTagUseCase,
  DeleteTagUseCase,
  DetachTagCreatorFromFamilyUseCase,
  GetTagsUseCase,
  RemoveFamilyFromTagScopesUseCase,
  UpdateTagUseCase,
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
    { provide: 'IFinanceRecurrenceRepository', useClass: FinanceRecurrenceRepository },
    { provide: 'IFinanceRecurrenceDatasource', useClass: FinanceRecurrenceDatasource },
    { provide: 'IFinanceTagRepository', useClass: FinanceTagRepository },
    { provide: 'IFinanceTagDatasource', useClass: FinanceTagDatasource },
    { provide: 'IFinanceTransactionRepository', useClass: FinanceTransactionRepository },
    { provide: 'IFinanceTransactionDatasource', useClass: FinanceTransactionDatasource },
  ],
})
export class FinanceModule {}
