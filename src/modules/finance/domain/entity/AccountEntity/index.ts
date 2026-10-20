import { AccountStatus } from '@finance/domain/enum';
import { CurrencyCode, DEFAULT_CURRENCY } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface IAccountEntity {
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
  updatedAt: Date;
}

class AccountEntity {
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
  updatedAt: Date;

  constructor(params: IAccountEntity) {
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
    this.updatedAt = params.updatedAt;
  }
}

export default AccountEntity;
