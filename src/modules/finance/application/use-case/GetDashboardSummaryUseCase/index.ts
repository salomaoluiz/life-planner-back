import { Inject } from '@nestjs/common';

import {
  GetDashboardSummaryInput,
  GetDashboardSummarySchema,
} from '@finance/application/dto/GetDashboardSummary';
import { GetDailyBalancesUseCase } from '@finance/application/use-case/GetDailyBalancesUseCase';
import {
  DashboardRow,
  GetDashboardRowsUseCase,
} from '@finance/application/use-case/GetDashboardRowsUseCase';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus, TransactionType } from '@finance/domain/enum';
import { CurrencyCode, SUPPORTED_CURRENCIES } from '@finance/domain/enum/Currency';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
} from '@finance/domain/repository';
import { balancesAtEnds, totalOf } from '@finance/domain/service/BalanceSeries';
import { previousPeriod } from '@finance/domain/service/DashboardPeriod';
import { addDays } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface CurrencyOption {
  accounts: number;
  cards: number;
  code: CurrencyCode;
}
export interface DashboardSummary {
  balance: { current: number; previous: number; projectedEnd: null | number };
  currencies: CurrencyOption[];
  currency: CurrencyCode;
  expense: { previous: number; projected: number; realized: number };
  income: { previous: number; projected: number; realized: number };
}

// Spec 046 FR 11: the four tiles. Income and expenses come from the dashboard rows; the balance follows only
// scope, currency and the accounts part of the filters (FR 10).
export class GetDashboardSummaryUseCase implements UseCaseWithParams<
  GetDashboardSummaryInput,
  DashboardSummary
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(GetDailyBalancesUseCase)
    private readonly getDailyBalancesUseCase: GetDailyBalancesUseCase,
    @Inject(GetDashboardRowsUseCase)
    private readonly getDashboardRowsUseCase: GetDashboardRowsUseCase,
  ) {}

  async execute(params: GetDashboardSummaryInput): Promise<DashboardSummary> {
    const input = validate(GetDashboardSummarySchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);
    const previous = previousPeriod(input.from, input.to);
    const [rows, previousRows, allAccounts, cards] = await Promise.all([
      this.getDashboardRowsUseCase.execute({ ...input, byTag: false }),
      this.getDashboardRowsUseCase.execute({ ...input, ...previous, byTag: false }),
      owners.length === 0 ? [] : this.accountRepository.findAccounts(owners),
      owners.length === 0 ? [] : this.creditCardRepository.findCreditCards(owners),
    ]);
    const accountFilter = input.filter?.accountIds?.length
      ? new Set(input.filter.accountIds)
      : undefined;
    const accounts = allAccounts.filter(
      (account) =>
        account.status === AccountStatus.ACTIVE &&
        account.currency === input.currency &&
        (!accountFilter || accountFilter.has(account.id)),
    );
    const paidRows =
      accounts.length === 0
        ? []
        : await this.accountRepository.findPaidSumsFrom({
            accountIds: accounts.map((account) => account.id),
            from: input.from,
          });
    const [atPreviousEnd, atToday] = balancesAtEnds(
      accounts.map((account) => ({ accountId: account.id, ledger: account.ledgerBalance })),
      paidRows,
      [addDays(input.from, -1), input.today],
    );

    // Spec 053 FR 14: the planned balance of the last day, only when that day is after today.
    let projectedEnd: null | number = null;

    if (input.to > input.today) {
      projectedEnd =
        accounts.length === 0
          ? 0
          : await this.plannedBalanceOn(input, new Set(accounts.map((account) => account.id)));
    }

    return {
      balance: { current: totalOf(atToday), previous: totalOf(atPreviousEnd), projectedEnd },
      currencies: currencyOptions(allAccounts, cards),
      currency: input.currency,
      expense: sumOf(rows, previousRows, TransactionType.EXPENSE),
      income: sumOf(rows, previousRows, TransactionType.INCOME),
    };
  }

  private async plannedBalanceOn(
    input: {
      accessibleOwners: GetDashboardSummaryInput['accessibleOwners'];
      ownerIds?: string[];
      to: string;
      today: string;
    },
    ids: Set<string>,
  ): Promise<number> {
    const planned = await this.getDailyBalancesUseCase.execute({
      accessibleOwners: input.accessibleOwners,
      month: input.to.slice(0, 7),
      ownerIds: input.ownerIds,
      today: input.today,
    });
    const day = planned.days.find((item) => item.date === input.to);

    return (day?.accounts ?? [])
      .filter((item) => ids.has(item.accountId))
      .reduce((total, item) => total + item.balance, 0);
  }
}

function currencyOptions(
  accounts: AccountEntity[],
  cards: { currency: CurrencyCode; status?: AccountStatus }[],
): CurrencyOption[] {
  return SUPPORTED_CURRENCIES.map((code) => ({
    accounts: accounts.filter((a) => a.currency === code && a.status === AccountStatus.ACTIVE)
      .length,
    cards: cards.filter((c) => c.currency === code && c.status !== AccountStatus.ARCHIVED).length,
    code,
  })).filter((option) => option.accounts + option.cards > 0);
}
function sumOf(rows: DashboardRow[], previousRows: DashboardRow[], type: TransactionType) {
  function total(list: DashboardRow[], projected?: boolean): number {
    return list
      .filter(
        (row) => row.type === type && (projected === undefined || row.projected === projected),
      )
      .reduce((sum, row) => sum + row.amount, 0);
  }

  return {
    previous: total(previousRows),
    projected: total(rows, true),
    realized: total(rows, false),
  };
}
