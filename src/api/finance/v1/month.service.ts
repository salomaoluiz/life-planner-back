import { Injectable } from '@nestjs/common';

import { toDailyBalancesOutput } from '@api/finance/v1/account.service';
import { MonthOutputShape } from '@api/finance/v1/dto/month.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { resolveToday } from '@api/finance/v1/finance-query';
import { toDetailOutput } from '@api/finance/v1/invoice.service';
import { toProjectedOutput } from '@api/finance/v1/recurrence.service';
import { toTransactionItem, toTransactionLookups } from '@api/finance/v1/transaction.service';
import {
  GetDailyBalancesUseCase,
  MAX_BALANCE_MONTHS_AHEAD,
} from '@finance/application/use-case/GetDailyBalancesUseCase';
import { GetInvoicesForListUseCase } from '@finance/application/use-case/GetInvoicesForListUseCase';
import { GetMonthSummaryUseCase } from '@finance/application/use-case/GetMonthSummaryUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionFilter } from '@finance/domain/entity/TransactionFilter';
import { addInvoiceMonths } from '@finance/domain/service/InvoiceCalculator';
import { lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';

// One page of rows; the summary walks the following pages itself (spec 080 FR 3).
const MONTH_ROWS_LIMIT = 500;

@Injectable()
export class MonthService {
  constructor(
    private readonly financeAccessService: FinanceAccessService,
    private readonly getDailyBalancesUseCase: GetDailyBalancesUseCase,
    private readonly getInvoicesForListUseCase: GetInvoicesForListUseCase,
    private readonly getMonthSummaryUseCase: GetMonthSummaryUseCase,
    private readonly getProjectionsUseCase: GetProjectionsUseCase,
    private readonly getTransactionsUseCase: GetTransactionsUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
  ) {}

  async find(
    userId: string,
    month: string,
    ownerIds?: string[],
    filter?: TransactionFilter,
    today?: string,
  ): Promise<MonthOutputShape> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const resolvedToday = resolveToday(today);
    const currentMonth = resolvedToday.slice(0, 7);
    const monthFilter: TransactionFilter = {
      ...filter,
      from: `${month}-01`,
      to: lastDayOfMonth(`${month}-01`),
    };

    // Once per request, not once per part (spec 080 FR 2).
    await this.materializeRecurrencesUseCase.execute({
      accessibleOwners,
      ownerIds,
      today: resolvedToday,
    });

    const [page, invoices, dailyBalances, projections] = await Promise.all([
      this.getTransactionsUseCase.execute({
        accessibleOwners,
        filter: monthFilter,
        limit: MONTH_ROWS_LIMIT,
        ownerIds,
        today: resolvedToday,
      }),
      this.getInvoicesForListUseCase.execute({
        accessibleOwners,
        filter,
        month,
        ownerIds,
        today: resolvedToday,
      }),
      // Past the balance horizon the screen simply has no balances; it must not fail as a whole.
      month > addInvoiceMonths(currentMonth, MAX_BALANCE_MONTHS_AHEAD)
        ? Promise.resolve({ accounts: [], days: [], month })
        : this.getDailyBalancesUseCase.execute({
            accessibleOwners,
            month,
            ownerIds,
            today: resolvedToday,
          }),
      // Only the months after the current one have projections; a card purchase lands on an invoice up to
      // two months later, so the range looks that far back.
      month > currentMonth
        ? this.getProjectionsUseCase.execute({
            accessibleOwners,
            filter,
            from: laterMonth(addInvoiceMonths(month, -2), addInvoiceMonths(currentMonth, 1)),
            ownerIds,
            to: month,
            today: resolvedToday,
          })
        : Promise.resolve([]),
    ]);

    const accountRows = [...page.items];
    let nextCursor = page.nextCursor;

    while (nextCursor) {
      const next = await this.getTransactionsUseCase.execute({
        accessibleOwners,
        cursor: nextCursor,
        filter: monthFilter,
        limit: MONTH_ROWS_LIMIT,
        ownerIds,
        today: resolvedToday,
      });

      accountRows.push(...next.items);
      nextCursor = next.nextCursor;
    }

    const summary = await this.getMonthSummaryUseCase.execute({
      accountRows,
      invoices,
      month,
      projections,
    });

    return {
      dailyBalances: toDailyBalancesOutput(dailyBalances),
      invoices: invoices.map((detail) => toDetailOutput(detail)),
      lookups: toTransactionLookups(page.items),
      month,
      projections: projections.map((item) => toProjectedOutput(item)),
      rows: {
        items: page.items.map((row: TransactionEntity) => toTransactionItem(row)),
        nextCursor: page.nextCursor,
      },
      summary,
    };
  }
}

function laterMonth(a: string, b: string): string {
  return a > b ? a : b;
}
