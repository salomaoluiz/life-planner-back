import AccountEntity from '@finance/domain/entity/AccountEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceAccountRepository = {
  createAccount(params: CreateAccountRepositoryParams): Promise<AccountEntity>;
  deleteAccount(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findAccountById(id: string): Promise<AccountEntity | undefined>;
  findAccounts(owners: OwnerAccess[]): Promise<AccountEntity[]>;
  updateAccount(params: UpdateAccountRepositoryParams): Promise<AccountEntity>;
};

interface CreateAccountRepositoryParams {
  balance: number;
  icon: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: AccountStatus;
}
interface UpdateAccountRepositoryParams {
  balance?: number;
  icon?: string;
  id: string;
  name?: string;
  status?: AccountStatus;
}

export { CreateAccountRepositoryParams, UpdateAccountRepositoryParams };
