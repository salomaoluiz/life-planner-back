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
import { GetAccountsUseCase } from '@finance/application/use-case/GetAccountsUseCase';
import { GetDailyBalancesUseCase } from '@finance/application/use-case/GetDailyBalancesUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { UpdateAccountUseCase } from '@finance/application/use-case/UpdateAccountUseCase';
import { AccountWithBalances } from '@finance/domain/service/AccountBalance';

// `ledgerBalance` is internal and never copied to the output.
function toAccountOutput({
  account,
  balance,
  projectedBalance,
}: AccountWithBalances): AccountOutput {
  return {
    balance,
    createdAt: account.createdAt.toISOString(),
    currency: account.currency,
    icon: account.icon,
    id: account.id,
    initialBalance: account.initialBalance,
    name: account.name,
    owner: account.owner,
    ownerId: account.ownerId,
    projectedBalance,
    status: account.status,
    updatedAt: account.updatedAt.toISOString(),
  };
}

@Injectable()
export class AccountService {
  constructor(
    private readonly adjustAccountBalanceUseCase: AdjustAccountBalanceUseCase,
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
    private readonly financeAccessService: FinanceAccessService,
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

    return toAccountOutput(result);
  }

  async create(
    userId: string,
    input: CreateAccountApiInput,
    today: string,
  ): Promise<AccountOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const account = await this.createAccountUseCase.execute({ ...input, accessibleOwners, today });

    return toAccountOutput(account);
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

    return accounts.map((account) => toAccountOutput(account));
  }

  async getDailyBalances(
    userId: string,
    ownerIds: string[] | undefined,
    month: string,
    today: string,
  ): Promise<DailyBalancesOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    // Spec 035 FR 17: due occurrences become real rows before the sums are read.
    await this.materializeRecurrencesUseCase.execute({ accessibleOwners, ownerIds, today });

    const result = await this.getDailyBalancesUseCase.execute({
      accessibleOwners,
      month,
      ownerIds,
      today,
    });

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
    });

    return toAccountOutput(account);
  }
}
