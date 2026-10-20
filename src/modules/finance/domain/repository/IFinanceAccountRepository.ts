import AccountEntity from '@finance/domain/entity/AccountEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { UnpaidSums } from '@finance/domain/service/AccountBalance';
import { DatedAmount } from '@finance/domain/service/DailyBalance';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceAccountRepository = {
  createAccount(params: CreateAccountRepositoryParams): Promise<AccountEntity>;
  deleteAccount(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findAccountById(id: string): Promise<AccountEntity | undefined>;
  findAccounts(owners: OwnerAccess[]): Promise<AccountEntity[]>;
  findAccountsByIds(ids: string[]): Promise<AccountEntity[]>;
  // ONE grouped query: signed PAID rows dated `from` or later, per account and day.
  findPaidSumsFrom(params: FindPaidSumsFromRepositoryParams): Promise<DatedAmount[]>;
  // ONE grouped query over the unpaid rows dated up to the end of `today`'s month; accounts without such rows are not returned.
  findUnpaidSums(params: FindUnpaidSumsRepositoryParams): Promise<UnpaidSums[]>;
  // ONE grouped query: signed UNPAID rows dated up to `to`, per account and day.
  findUnpaidSumsUntil(params: FindUnpaidSumsUntilRepositoryParams): Promise<DatedAmount[]>;
  updateAccount(params: UpdateAccountRepositoryParams): Promise<AccountEntity>;
};

interface CreateAccountRepositoryParams {
  currency: CurrencyCode;
  icon: string;
  // The new account starts with ledger == initial (no transactions yet).
  initialBalance: number;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: AccountStatus;
}
interface FindPaidSumsFromRepositoryParams {
  accountIds: string[];
  // `YYYY-MM-DD`
  from: string;
}
interface FindUnpaidSumsRepositoryParams {
  accountIds: string[];
  // `YYYY-MM-DD`
  today: string;
}
interface FindUnpaidSumsUntilRepositoryParams {
  accountIds: string[];
  // `YYYY-MM-DD`
  to: string;
}
interface UpdateAccountRepositoryParams {
  icon?: string;
  id: string;
  name?: string;
  status?: AccountStatus;
}

export {
  CreateAccountRepositoryParams,
  FindPaidSumsFromRepositoryParams,
  FindUnpaidSumsRepositoryParams,
  FindUnpaidSumsUntilRepositoryParams,
  UpdateAccountRepositoryParams,
};
