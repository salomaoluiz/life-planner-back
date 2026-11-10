import { Injectable } from '@nestjs/common';

import {
  AccountOutput,
  CreateAccountApiInput,
  DailyBalancesOutput,
  UpdateAccountApiInput,
} from '@api/finance/v1/dto/account.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { AdjustAccountBalanceUseCase } from '@finance/application/use-case/AdjustAccountBalanceUseCase';
import { CreateAccountUseCase } from '@finance/application/use-case/CreateAccountUseCase';
import { DeleteAccountUseCase } from '@finance/application/use-case/DeleteAccountUseCase';
import { GetAccountFavoriteUseCase } from '@finance/application/use-case/GetAccountFavoriteUseCase';
import { GetAccountsUseCase } from '@finance/application/use-case/GetAccountsUseCase';
import {
  DailyBalances,
  GetDailyBalancesUseCase,
} from '@finance/application/use-case/GetDailyBalancesUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { UpdateAccountUseCase } from '@finance/application/use-case/UpdateAccountUseCase';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { AccountWithBalances } from '@finance/domain/service/AccountBalance';

// `ledgerBalance` is internal and never copied to the output.
function toAccountOutput(
  { account, balance, projectedBalance }: AccountWithBalances,
  favoriteId: string | undefined,
): AccountOutput {
  return {
    archivedAt: account.archivedAt?.toISOString() ?? null,
    balance,
    createdAt: account.createdAt.toISOString(),
    currency: account.currency,
    icon: account.icon,
    id: account.id,
    initialBalance: account.initialBalance,
    isFavorite: account.id === favoriteId,
    name: account.name,
    owner: account.owner,
    ownerId: account.ownerId,
    projectedBalance,
    status: account.status,
    type: account.type,
    updatedAt: account.updatedAt.toISOString(),
  };
}
function toDailyBalancesOutput(result: DailyBalances): DailyBalancesOutput {
  return {
    accounts: result.accounts.map((account) => ({
      icon: account.icon,
      id: account.id,
      name: account.name,
      owner: account.owner,
      ownerId: account.ownerId,
    })),
    days: result.days,
    month: result.month,
  };
}

export { toDailyBalancesOutput };

@Injectable()
export class AccountService {
  constructor(
    private readonly adjustAccountBalanceUseCase: AdjustAccountBalanceUseCase,
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getAccountFavoriteUseCase: GetAccountFavoriteUseCase,
    private readonly getAccountsUseCase: GetAccountsUseCase,
    private readonly getDailyBalancesUseCase: GetDailyBalancesUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
    private readonly updateAccountUseCase: UpdateAccountUseCase,
  ) {}

  async adjustBalance(
    userId: string,
    id: string,
    balance: number,
    today: string,
  ): Promise<AccountOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const result = await this.adjustAccountBalanceUseCase.execute({
      accessibleOwners,
      balance,
      id,
      today,
    });

    return toAccountOutput(result, await this.getAccountFavoriteUseCase.execute({ userId }));
  }

  async create(
    userId: string,
    input: CreateAccountApiInput,
    today: string,
  ): Promise<AccountOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const account = await this.createAccountUseCase.execute({
      ...input,
      accessibleOwners,
      today,
      userId,
    });

    return toAccountOutput(account, await this.getAccountFavoriteUseCase.execute({ userId }));
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteAccountUseCase.execute({ accessibleOwners, id });
  }

  async findAll(
    userId: string,
    ownerIds: string[] | undefined,
    today: string,
  ): Promise<AccountOutput[]> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    // The end-of-month balance counts the unpaid occurrences of the month (spec 034 FR 9).
    await this.materializeRecurrencesUseCase.execute({ accessibleOwners, ownerIds, today });

    const accounts = await this.getAccountsUseCase.execute({ accessibleOwners, ownerIds, today });
    // ONE extra read for the whole list (spec 094 FR 9).
    const favoriteId = await this.getAccountFavoriteUseCase.execute({ userId });

    return accounts.map((account) => toAccountOutput(account, favoriteId));
  }

  async getDailyBalances(
    userId: string,
    ownerIds: string[] | undefined,
    month: string,
    today: string,
    currency?: CurrencyCode,
  ): Promise<DailyBalancesOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    // Spec 035 FR 17: due occurrences become real rows before the sums are read.
    await this.materializeRecurrencesUseCase.execute({ accessibleOwners, ownerIds, today });

    const result = await this.getDailyBalancesUseCase.execute({
      accessibleOwners,
      currency,
      month,
      ownerIds,
      today,
    });

    return toDailyBalancesOutput(result);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateAccountApiInput,
    today: string,
  ): Promise<AccountOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const account = await this.updateAccountUseCase.execute({
      ...input,
      accessibleOwners,
      id,
      today,
      userId,
    });

    return toAccountOutput(account, await this.getAccountFavoriteUseCase.execute({ userId }));
  }
}
