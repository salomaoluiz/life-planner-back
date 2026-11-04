import { Module } from '@nestjs/common';

import { AccountController } from '@api/finance/v1/account.controller';
import { AccountService } from '@api/finance/v1/account.service';
import { CardCreditController } from '@api/finance/v1/card-credit.controller';
import { CardCreditService } from '@api/finance/v1/card-credit.service';
import { CategoryIconController } from '@api/finance/v1/category-icon.controller';
import { CategoryIconService } from '@api/finance/v1/category-icon.service';
import { CategoryController } from '@api/finance/v1/category.controller';
import { CategoryService } from '@api/finance/v1/category.service';
import { CreditCardController } from '@api/finance/v1/credit-card.controller';
import { CreditCardService } from '@api/finance/v1/credit-card.service';
import { DashboardController } from '@api/finance/v1/dashboard.controller';
import { DashboardService } from '@api/finance/v1/dashboard.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { InstallmentPlanController } from '@api/finance/v1/installment-plan.controller';
import { InstallmentPlanService } from '@api/finance/v1/installment-plan.service';
import { InvoiceController } from '@api/finance/v1/invoice.controller';
import { InvoiceService } from '@api/finance/v1/invoice.service';
import { MonthController } from '@api/finance/v1/month.controller';
import { MonthService } from '@api/finance/v1/month.service';
import { RecurrenceProjectionController } from '@api/finance/v1/recurrence-projection.controller';
import { RecurrenceController } from '@api/finance/v1/recurrence.controller';
import { RecurrenceService } from '@api/finance/v1/recurrence.service';
import { TagController } from '@api/finance/v1/tag.controller';
import { TagService } from '@api/finance/v1/tag.service';
import { TransactionCsvController } from '@api/finance/v1/transaction-csv.controller';
import { TransactionCsvService } from '@api/finance/v1/transaction-csv.service';
import { TransactionController } from '@api/finance/v1/transaction.controller';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { UpcomingController } from '@api/finance/v1/upcoming.controller';
import { UpcomingService } from '@api/finance/v1/upcoming.service';
import { FamilyModule } from '@family/family.module';
import { FinanceModule } from '@finance/finance.module';

@Module({
  // InvoiceController first: its static `credit-cards/invoices` route must win over CreditCardController's `:id`;
  // RecurrenceProjectionController before RecurrenceController for the same reason.
  controllers: [
    AccountController,
    CardCreditController,
    CategoryController,
    CategoryIconController,
    InvoiceController,
    MonthController,
    CreditCardController,
    DashboardController,
    InstallmentPlanController,
    RecurrenceProjectionController,
    RecurrenceController,
    TagController,
    TransactionCsvController,
    TransactionController,
    UpcomingController,
  ],
  imports: [FamilyModule, FinanceModule],
  providers: [
    AccountService,
    CardCreditService,
    CategoryIconService,
    CategoryService,
    CreditCardService,
    DashboardService,
    FinanceAccessService,
    InstallmentPlanService,
    InvoiceService,
    MonthService,
    RecurrenceService,
    TagService,
    TransactionCsvService,
    TransactionService,
    UpcomingService,
  ],
})
export class FinanceAPIModule {}
