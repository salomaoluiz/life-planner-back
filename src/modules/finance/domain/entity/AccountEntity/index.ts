import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface IAccountEntity {
  balance: number;
  createdAt: Date;
  icon: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: AccountStatus;
  updatedAt: Date;
}

class AccountEntity {
  balance: number;
  createdAt: Date;
  icon: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: AccountStatus;
  updatedAt: Date;

  constructor(params: IAccountEntity) {
    this.balance = params.balance;
    this.createdAt = params.createdAt;
    this.icon = params.icon;
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.status = params.status;
    this.updatedAt = params.updatedAt;
  }
}

export default AccountEntity;
