import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { InvoiceStatus, TransactionType } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { Invoice } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface GetMonthSummaryInput {
  // Every account row of the month that matches the filter (not only the first page).
  accountRows: TransactionEntity[];
  // `filtered` is set when the list was filtered (spec 045): only the matching purchases count then.
  invoices: {
    filtered?: { filteredTotal: number };
    invoice: Pick<Invoice, 'amount' | 'amountDue' | 'earlyPaid' | 'status'>;
  }[];
  // Spec 103: the currency of everything passed in; it is the currency of the summary.
  currency: CurrencyCode;
  // `YYYY-MM`
  month: string;
  projections: ProjectedOccurrence[];
}

// Spec 080: `income/expense/toPay/toReceive` are the real figures (as the app computed them);
// `projectedIncome/projectedExpense` are what the series will still add to a month after the current one.
export interface MonthSummary {
  currency: CurrencyCode;
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
      currency: params.currency,
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

    for (const { filtered, invoice } of params.invoices) {
      if (filtered) {
        summary.expense += filtered.filteredTotal;
        summary.toPay += invoice.status === InvoiceStatus.PAID ? 0 : filtered.filteredTotal;
        continue;
      }

      // What is due plus what was paid early: credits lower the expense, early payments only move money (spec 032 FR 9).
      summary.expense += invoice.amount + invoice.earlyPaid;

      // An invoice that is paid (or settled by credits) has nothing left to pay (spec 033 FR 16).
      if (invoice.status !== InvoiceStatus.PAID) {
        summary.toPay += invoice.amountDue;
      }
    }

    for (const item of params.projections) {
      if (item.category.excludeFromTotals) {
        continue;
      }

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
