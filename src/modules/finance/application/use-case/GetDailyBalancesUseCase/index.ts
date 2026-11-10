import { BadRequestException, ForbiddenException, Inject } from '@nestjs/common';

import {
  GetDailyBalancesInput,
  GetDailyBalancesSchema,
} from '@finance/application/dto/GetDailyBalances';
import {
  CardInvoiceData,
  ComputeCardInvoicesUseCase,
} from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import { AccountStatus, TransactionType } from '@finance/domain/enum';
import {
  IFinanceAccountRepository,
  IFinanceCreditCardRepository,
} from '@finance/domain/repository';
import { buildDailyBalances, DatedAmount, DayBalance } from '@finance/domain/service/DailyBalance';
import {
  addInvoiceMonths,
  invoiceBuilderFor,
  InvoiceTotal,
} from '@finance/domain/service/InvoiceCalculator';
import { lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export const MAX_BALANCE_MONTHS_AHEAD = 24;

export interface DailyBalances {
  accounts: AccountEntity[];
  days: DayBalance[];
  month: string;
}

interface CardDue {
  accountId?: string;
  amount: number;
  date: string;
}

// Spec 035: the end-of-day balance of every day of a month, from grouped sums (never the whole history),
// the 034 projections and the invoices still to pay.
export class GetDailyBalancesUseCase implements UseCaseWithParams<
  GetDailyBalancesInput,
  DailyBalances
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject(ComputeCardInvoicesUseCase)
    private readonly computeCardInvoicesUseCase: ComputeCardInvoicesUseCase,
    @Inject('IFinanceCreditCardRepository')
    private readonly creditCardRepository: IFinanceCreditCardRepository,
    @Inject(GetProjectionsUseCase)
    private readonly getProjectionsUseCase: GetProjectionsUseCase,
  ) {}

  async execute(params: GetDailyBalancesInput): Promise<DailyBalances> {
    const input = validate(GetDailyBalancesSchema, params);
    const todayMonth = input.today.slice(0, 7);

    const untilMonth = input.untilMonth ?? input.month;

    if (
      untilMonth < input.month ||
      untilMonth > addInvoiceMonths(todayMonth, MAX_BALANCE_MONTHS_AHEAD)
    ) {
      throw new BadRequestException('Month is too far ahead');
    }
    if (
      input.ownerIds?.some(
        (ownerId) => !input.accessibleOwners.some((access) => access.ownerId === ownerId),
      )
    ) {
      throw new ForbiddenException('Owner not accessible');
    }

    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);
    const monthStart = `${input.month}-01`;
    const monthEnd = lastDayOfMonth(`${untilMonth}-01`);
    const preloaded = input.preloaded;
    const [allAccounts, allCards] =
      owners.length === 0
        ? [[], []]
        : await Promise.all([
            preloaded?.accounts ?? this.accountRepository.findAccounts(owners),
            preloaded?.cards ?? this.creditCardRepository.findCreditCards(owners),
          ]);
    // Spec 103: a read in one currency only considers the accounts and cards in that currency.
    const accounts = allAccounts
      .filter(
        (account) =>
          account.status === AccountStatus.ACTIVE &&
          (!input.currency || account.currency === input.currency),
      )
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    const cards = input.currency
      ? allCards.filter((card) => card.currency === input.currency)
      : allCards;
    const accountIds = accounts.map((account) => account.id);
    const hasPending = monthEnd >= input.today;
    const [paidRows, unpaidRows, invoiceData, projections] = await Promise.all([
      this.accountRepository.findPaidSumsFrom({ accountIds, from: monthStart }),
      hasPending
        ? this.accountRepository.findUnpaidSumsUntil({ accountIds, to: monthEnd })
        : Promise.resolve<DatedAmount[]>([]),
      hasPending && cards.length > 0
        ? this.computeCardInvoicesUseCase.execute({ cards, today: input.today })
        : Promise.resolve<CardInvoiceData[]>([]),
      hasPending && untilMonth > todayMonth
        ? this.getProjectionsUseCase.executeChunked({
            accessibleOwners: input.accessibleOwners,
            filter: input.currency ? { currency: input.currency } : undefined,
            from: addInvoiceMonths(todayMonth, 1),
            ownerIds: input.ownerIds,
            to: untilMonth,
            today: input.today,
          })
        : Promise.resolve<ProjectedOccurrence[]>([]),
    ]);

    const included = new Set(accountIds);
    const dues = invoicesDue(invoiceData, projections, input.today, monthEnd);
    const pending = [
      ...unpaidRows,
      ...projections.flatMap((item) =>
        item.account && included.has(item.account.id)
          ? [{ accountId: item.account.id, amount: signed(item), date: item.date }]
          : [],
      ),
      ...dues.flatMap((due) =>
        due.accountId && included.has(due.accountId)
          ? [{ accountId: due.accountId, amount: due.amount, date: due.date }]
          : [],
      ),
    ];
    const cardsDue = dues
      .filter((due) => !due.accountId || !included.has(due.accountId))
      .map(({ amount, date }) => ({ amount, date }));

    return {
      accounts,
      days: buildDailyBalances({
        // The ledger holds every paid row whatever its date: take back the ones from the month on.
        accounts: accounts.map((account) => ({
          accountId: account.id,
          opening:
            account.ledgerBalance -
            paidRows
              .filter((row) => row.accountId === account.id)
              .reduce((total, row) => total + row.amount, 0),
        })),
        cardsDue,
        lastMonth: untilMonth,
        month: input.month,
        paid: paidRows.filter((row) => row.date <= monthEnd),
        pending,
        today: input.today,
      }),
      month: input.month,
    };
  }
}

// Unpaid invoices (no payment record, amount due > 0) whose planned payment day is up to `monthEnd`;
// projected card occurrences add to their invoice before it is built (FR 5).
function invoicesDue(
  data: CardInvoiceData[],
  projections: ProjectedOccurrence[],
  today: string,
  monthEnd: string,
): CardDue[] {
  return data.flatMap(({ card, payments, totals }) => {
    const merged = new Map<string, InvoiceTotal>(
      totals.map((total) => [total.invoiceMonth, { ...total }]),
    );

    for (const item of projections) {
      if (item.creditCard?.id !== card.id || !item.invoiceMonth) {
        continue;
      }

      const current = merged.get(item.invoiceMonth) ?? {
        amount: 0,
        invoiceMonth: item.invoiceMonth,
      };

      merged.set(item.invoiceMonth, { ...current, amount: current.amount - signed(item) });
    }

    const invoiceOf = invoiceBuilderFor(card, [...merged.values()], payments, today);

    return [...merged.keys()].flatMap((month) => {
      const invoice = invoiceOf(month);

      return invoice.payment === null &&
        invoice.projectedTotal > 0 &&
        invoice.paymentDate <= monthEnd
        ? [
            {
              accountId: card.paymentAccountId,
              amount: -invoice.projectedTotal,
              date: invoice.paymentDate,
            },
          ]
        : [];
    });
  });
}
// Income +, expense −.
function signed(item: ProjectedOccurrence): number {
  return item.type === TransactionType.INCOME ? item.value : -item.value;
}
