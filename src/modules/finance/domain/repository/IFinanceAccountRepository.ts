import AccountEntity from '@finance/domain/entity/AccountEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { UnpaidSums } from '@finance/domain/service/AccountBalance';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceAccountRepository = {
  createAccount(params: CreateAccountRepositoryParams): Promise<AccountEntity>;
  deleteAccount(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findAccountById(id: string): Promise<AccountEntity | undefined>;
  findAccounts(owners: OwnerAccess[]): Promise<AccountEntity[]>;
  // ONE grouped query over the unpaid rows dated up to the end of `today`'s month; accounts without such rows are not returned.
  findUnpaidSums(params: FindUnpaidSumsRepositoryParams): Promise<UnpaidSums[]>;
  updateAccount(params: UpdateAccountRepositoryParams): Promise<AccountEntity>;
};

interface CreateAccountRepositoryParams {
  icon: string;
  // The new account starts with ledger == initial (no transactions yet).
  initialBalance: number;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: AccountStatus;
}
interface FindUnpaidSumsRepositoryParams {
  accountIds: string[];
  // `YYYY-MM-DD`
  today: string;
}
interface UpdateAccountRepositoryParams {
  icon?: string;
  id: string;
  name?: string;
  status?: AccountStatus;
}

export {
  CreateAccountRepositoryParams,
  FindUnpaidSumsRepositoryParams,
  UpdateAccountRepositoryParams,
};
