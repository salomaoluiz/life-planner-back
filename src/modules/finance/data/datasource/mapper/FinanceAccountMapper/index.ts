import { FinancialAccount } from '@db/client';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { AccountStatus } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceAccountMapper {
  static toDomain(raw: FinancialAccount): AccountEntity {
    return new AccountEntity({
      archivedAt: raw.archived_at ?? undefined,
      createdAt: raw.created_at,
      currency: raw.currency as CurrencyCode,
      icon: raw.icon,
      id: raw.id,
      initialBalance: raw.initial_balance,
      ledgerBalance: raw.ledger_balance,
      name: raw.name,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      status: AccountStatus[raw.status],
      updatedAt: raw.updated_at,
    });
  }
}
