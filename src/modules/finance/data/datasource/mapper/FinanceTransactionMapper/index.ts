import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceTransactionMapper {
  static toDomain(raw: FinancialTransactionWithRelations): TransactionEntity {
    return new TransactionEntity({
      account: raw.account
        ? { icon: raw.account.icon, id: raw.account.id, name: raw.account.name }
        : null,
      accountId: raw.account_id,
      category: {
        excludeFromTotals: raw.category.exclude_from_totals,
        icon: raw.category.icon,
        iconColor: raw.category.icon_color,
        id: raw.category.id,
        name: raw.category.name,
        systemKey: raw.category.system_key ? SystemCategoryKey[raw.category.system_key] : null,
      },
      categoryId: raw.category_id,
      createdAt: raw.created_at,
      creditCard: raw.credit_card
        ? {
            color: raw.credit_card.color,
            id: raw.credit_card.id,
            lastDigits: raw.credit_card.last_digits ?? undefined,
            title: raw.credit_card.title,
          }
        : null,
      creditCardId: raw.credit_card_id,
      date: toCalendarDate(raw.date),
      description: raw.description,
      id: raw.id,
      invoiceMonth: raw.invoice_month,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      type: TransactionType[raw.type],
      updatedAt: raw.updated_at,
      value: raw.value,
    });
  }
}
