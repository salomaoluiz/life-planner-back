import { BadRequestException, Inject } from '@nestjs/common';

import {
  GetBalanceSeriesInput,
  GetBalanceSeriesSchema,
} from '@finance/application/dto/GetBalanceSeries';
import { GetDailyBalancesUseCase } from '@finance/application/use-case/GetDailyBalancesUseCase';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { IFinanceAccountRepository } from '@finance/domain/repository';
import { balancesAtEnds, totalOf } from '@finance/domain/service/BalanceSeries';
import {
  Bucket,
  buildBuckets,
  Granularity,
  isGranularityAllowed,
} from '@finance/domain/service/DashboardPeriod';
import { addDays } from '@finance/domain/service/RecurrenceSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface BalancePoint {
  accounts: { balance: number; id: string; name: string }[];
  balance: number;
  end: string;
  // After today: the planned balance of the daily series (spec 035).
  projected: boolean;
  start: string;
}
export interface BalanceSeries {
  currency: CurrencyCode;
  granularity: Granularity;
  points: BalancePoint[];
}

// Spec 046 FR 12: the balance at the end of every bucket. The past comes from the ledger minus the later paid
// rows; the part after today from the planned daily balances of every month up to the end (spec 035, 053).
export class GetBalanceSeriesUseCase implements UseCaseWithParams<
  GetBalanceSeriesInput,
  BalanceSeries
> {
  constructor(
    @Inject('IFinanceAccountRepository')
    private readonly accountRepository: IFinanceAccountRepository,
    @Inject(GetDailyBalancesUseCase)
    private readonly getDailyBalancesUseCase: GetDailyBalancesUseCase,
  ) {}

  async execute(params: GetBalanceSeriesInput): Promise<BalanceSeries> {
    const input = validate(GetBalanceSeriesSchema, params);

    if (!isGranularityAllowed(input.granularity, input.from, input.to)) {
      throw new BadRequestException('Granularity not allowed for this period');
    }

    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);
    const buckets = splitAtToday(
      buildBuckets(input.from, input.to, input.granularity),
      input.today,
    );
    const filter = input.filter?.accountIds?.length ? new Set(input.filter.accountIds) : undefined;
    const accounts = (owners.length === 0 ? [] : await this.accountRepository.findAccounts(owners))
      .filter(
        (account) =>
          account.status === AccountStatus.ACTIVE &&
          account.currency === input.currency &&
          (!filter || filter.has(account.id)),
      )
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    if (accounts.length === 0) {
      return {
        currency: input.currency,
        granularity: input.granularity,
        points: buckets.map((bucket) => ({
          ...bucket,
          accounts: [],
          balance: 0,
          projected: bucket.end > input.today,
        })),
      };
    }

    const ids = new Set(accounts.map((account) => account.id));
    const names = new Map(accounts.map((account) => [account.id, account.name]));
    const paidRows = await this.accountRepository.findPaidSumsFrom({
      accountIds: [...ids],
      from: input.from,
    });
    const past = balancesAtEnds(
      accounts.map((account) => ({ accountId: account.id, ledger: account.ledgerBalance })),
      paidRows,
      buckets.map((bucket) => bucket.end),
    );
    const planned = buckets.some((bucket) => bucket.end > input.today)
      ? await this.getDailyBalancesUseCase.execute({
          accessibleOwners: input.accessibleOwners,
          month: input.today.slice(0, 7),
          ownerIds: input.ownerIds,
          today: input.today,
          untilMonth:
            input.to.slice(0, 7) > input.today.slice(0, 7) ? input.to.slice(0, 7) : undefined,
        })
      : undefined;

    return {
      currency: input.currency,
      granularity: input.granularity,
      points: buckets.map((bucket, index) => {
        const projected = bucket.end > input.today;
        const items = projected
          ? (planned?.days.find((day) => day.date === bucket.end)?.accounts ?? []).filter((item) =>
              ids.has(item.accountId),
            )
          : past[index];

        return {
          ...bucket,
          accounts: items.map((item) => ({
            balance: item.balance,
            id: item.accountId,
            name: names.get(item.accountId) ?? '',
          })),
          balance: totalOf(items),
          projected,
        };
      }),
    };
  }
}

// The bucket that holds today is worth the balance of today (realized); the rest of it follows as a projected point
// (spec 046 FR 12: the line continues dashed from today to the end of the month).
function splitAtToday(buckets: Bucket[], today: string): Bucket[] {
  return buckets.flatMap((bucket) =>
    bucket.start <= today && today < bucket.end
      ? [
          { end: today, start: bucket.start },
          { end: bucket.end, start: addDays(today, 1) },
        ]
      : [bucket],
  );
}
