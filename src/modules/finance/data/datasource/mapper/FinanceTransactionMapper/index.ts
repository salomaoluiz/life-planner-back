import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceTransactionMapper {
  static toDomain(raw: FinancialTransactionWithRelations): TransactionEntity {
    return new TransactionEntity({
      account: { icon: raw.account.icon, id: raw.account.id, name: raw.account.name },
      accountId: raw.account_id,
      category: {
        icon: raw.category.icon,
        iconColor: raw.category.icon_color,
        id: raw.category.id,
        name: raw.category.name,
      },
      categoryId: raw.category_id,
      createdAt: raw.created_at,
      date: toCalendarDate(raw.date),
      description: raw.description,
      id: raw.id,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      type: TransactionType[raw.type],
      updatedAt: raw.updated_at,
      value: raw.value,
    });
  }
}
