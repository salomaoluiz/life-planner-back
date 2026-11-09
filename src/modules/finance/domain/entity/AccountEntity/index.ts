import { AccountStatus, AccountType } from '@finance/domain/enum';
import { CurrencyCode, DEFAULT_CURRENCY } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface IAccountEntity {
  archivedAt?: Date;
  createdAt: Date;
  currency?: CurrencyCode;
  icon: string;
  id: string;
  initialBalance: number;
  ledgerBalance: number;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: AccountStatus;
  type?: AccountType;
  updatedAt: Date;
}

class AccountEntity {
  archivedAt?: Date;
  createdAt: Date;
  currency: CurrencyCode;
  icon: string;
  id: string;
  // Cents, set at creation and never edited.
  initialBalance: number;
  // Cents: initial + every transaction whatever its date. Internal, never sent to the client.
  ledgerBalance: number;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: AccountStatus;
  type: AccountType;
  updatedAt: Date;

  constructor(params: IAccountEntity) {
    this.archivedAt = params.archivedAt;
    this.createdAt = params.createdAt;
    this.currency = params.currency ?? DEFAULT_CURRENCY;
    this.icon = params.icon;
    this.id = params.id;
    this.initialBalance = params.initialBalance;
    this.ledgerBalance = params.ledgerBalance;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.status = params.status;
    this.type = params.type ?? AccountType.CHECKING;
    this.updatedAt = params.updatedAt;
  }
}

export default AccountEntity;
