import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { InvoiceStatus, TransactionType } from '@finance/domain/enum';
import { Invoice } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface GetMonthSummaryInput {
  // Every account row of the month that matches the filter (not only the first page).
  accountRows: TransactionEntity[];
  invoices: { invoice: Pick<Invoice, 'amount' | 'amountDue' | 'earlyPaid' | 'status'> }[];
  // `YYYY-MM`
  month: string;
  projections: ProjectedOccurrence[];
}

// Spec 080: `income/expense/toPay/toReceive` are the real figures (as the app computed them);
// `projectedIncome/projectedExpense` are what the series will still add to a month after the current one.
export interface MonthSummary {
  currency: 'BRL';
  expense: number;
  income: number;
  projectedExpense: number;
  projectedIncome: number;
  toPay: number;
  toReceive: number;
}

// The month summary rules: card purchases count on the month their invoice is paid (spec 029 FR 25),
// projected occurrences exist only after the current month (spec 034 FR 15), `excludeFromTotals` rows are out.
export class GetMonthSummaryUseCase implements UseCaseWithParams<
  GetMonthSummaryInput,
  MonthSummary
> {
  async execute(params: GetMonthSummaryInput): Promise<MonthSummary> {
    const summary: MonthSummary = {
      currency: 'BRL',
      expense: 0,
      income: 0,
      projectedExpense: 0,
      projectedIncome: 0,
      toPay: 0,
      toReceive: 0,
    };

    for (const row of params.accountRows) {
      if (
        row.creditCardId ||
        row.category.excludeFromTotals ||
        row.date.slice(0, 7) !== params.month
      ) {
        continue;
      }

      if (row.type === TransactionType.INCOME) {
        summary.income += row.value;
        summary.toReceive += row.paid ? 0 : row.value;
      } else {
        summary.expense += row.value;
        summary.toPay += row.paid ? 0 : row.value;
      }
    }

    for (const { invoice } of params.invoices) {
      // What is due plus what was paid early: credits lower the expense, early payments only move money (spec 032 FR 9).
      summary.expense += invoice.amount + invoice.earlyPaid;

      // An invoice that is paid (or settled by credits) has nothing left to pay (spec 033 FR 16).
      if (invoice.status !== InvoiceStatus.PAID) {
        summary.toPay += invoice.amountDue;
      }
    }

    for (const item of params.projections) {
      if (item.creditCard) {
        if (item.invoiceListDate?.slice(0, 7) === params.month) {
          summary.projectedExpense += item.value;
        }
      } else if (item.date.slice(0, 7) === params.month) {
        if (item.type === TransactionType.INCOME) {
          summary.projectedIncome += item.value;
        } else {
          summary.projectedExpense += item.value;
        }
      }
    }

    return summary;
  }
}
