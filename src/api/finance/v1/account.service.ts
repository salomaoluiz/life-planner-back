import { Injectable } from '@nestjs/common';

import {
  AccountOutput,
  CreateAccountApiInput,
  UpdateAccountApiInput,
} from '@api/finance/v1/dto/account.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateAccountUseCase } from '@finance/application/use-case/CreateAccountUseCase';
import { DeleteAccountUseCase } from '@finance/application/use-case/DeleteAccountUseCase';
import { GetAccountsUseCase } from '@finance/application/use-case/GetAccountsUseCase';
import { UpdateAccountUseCase } from '@finance/application/use-case/UpdateAccountUseCase';
import AccountEntity from '@finance/domain/entity/AccountEntity';

function toAccountOutput(account: AccountEntity): AccountOutput {
  return {
    balance: account.balance,
    createdAt: account.createdAt.toISOString(),
    icon: account.icon,
    id: account.id,
    name: account.name,
    owner: account.owner,
    ownerId: account.ownerId,
    status: account.status,
    updatedAt: account.updatedAt.toISOString(),
  };
}

@Injectable()
export class AccountService {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getAccountsUseCase: GetAccountsUseCase,
    private readonly updateAccountUseCase: UpdateAccountUseCase,
  ) {}

  async create(userId: string, input: CreateAccountApiInput): Promise<AccountOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const account = await this.createAccountUseCase.execute({ ...input, accessibleOwners });

    return toAccountOutput(account);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteAccountUseCase.execute({ accessibleOwners, id });
  }

  async findAll(userId: string, ownerIds?: string[]): Promise<AccountOutput[]> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const accounts = await this.getAccountsUseCase.execute({ accessibleOwners, ownerIds });

    return accounts.map((account) => toAccountOutput(account));
  }

  async update(userId: string, id: string, input: UpdateAccountApiInput): Promise<AccountOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    const account = await this.updateAccountUseCase.execute({ ...input, accessibleOwners, id });

    return toAccountOutput(account);
  }
}
