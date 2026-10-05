import { FinancialAccount } from '@db/client';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceAccountMapper {
  static toDomain(raw: FinancialAccount): AccountEntity {
    return new AccountEntity({
      balance: raw.balance,
      createdAt: raw.created_at,
      icon: raw.icon,
      id: raw.id,
      name: raw.name,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      status: AccountStatus[raw.status],
      updatedAt: raw.updated_at,
    });
  }
}
