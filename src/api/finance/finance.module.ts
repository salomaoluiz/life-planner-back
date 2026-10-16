import { Module } from '@nestjs/common';

import { AccountController } from '@api/finance/v1/account.controller';
import { AccountService } from '@api/finance/v1/account.service';
import { CategoryController } from '@api/finance/v1/category.controller';
import { CategoryService } from '@api/finance/v1/category.service';
import { CreditCardController } from '@api/finance/v1/credit-card.controller';
import { CreditCardService } from '@api/finance/v1/credit-card.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { InstallmentPlanController } from '@api/finance/v1/installment-plan.controller';
import { InstallmentPlanService } from '@api/finance/v1/installment-plan.service';
import { InvoiceController } from '@api/finance/v1/invoice.controller';
import { InvoiceService } from '@api/finance/v1/invoice.service';
import { TransactionController } from '@api/finance/v1/transaction.controller';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { FamilyModule } from '@family/family.module';
import { FinanceModule } from '@finance/finance.module';

@Module({
  // InvoiceController first: its static `credit-cards/invoices` route must win over CreditCardController's `:id`.
  controllers: [
    AccountController,
    CategoryController,
    InvoiceController,
    CreditCardController,
    InstallmentPlanController,
    TransactionController,
  ],
  imports: [FamilyModule, FinanceModule],
  providers: [
    AccountService,
    CategoryService,
    CreditCardService,
    FinanceAccessService,
    InstallmentPlanService,
    InvoiceService,
    TransactionService,
  ],
})
export class FinanceAPIModule {}
