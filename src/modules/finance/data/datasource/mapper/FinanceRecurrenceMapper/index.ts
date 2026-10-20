import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { toTagRefs } from '@finance/data/datasource/tags';
import { FinancialRecurrenceWithRelations } from '@finance/data/repository/datasource/IFinanceRecurrenceDatasource';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import {
  RecurrenceFrequency,
  RecurrenceStatus,
  SystemCategoryKey,
  TransactionType,
} from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { totalOccurrences } from '@finance/domain/service/RecurrenceSchedule';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceRecurrenceMapper {
  static toDomain(raw: FinancialRecurrenceWithRelations): RecurrenceEntity {
    const endDate = raw.end_date ? toCalendarDate(raw.end_date) : null;
    const frequency = RecurrenceFrequency[raw.frequency];
    const startDate = toCalendarDate(raw.start_date);

    return new RecurrenceEntity({
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
      currency: raw.currency as CurrencyCode,
      description: raw.description,
      endDate,
      firstNumber: raw.first_number,
      frequency,
      id: raw.id,
      lastGeneratedNumber: raw.last_generated_number,
      nextOccurrenceDate: raw.next_occurrence_date
        ? toCalendarDate(raw.next_occurrence_date)
        : null,
      occurrenceCount: totalOccurrences({ endDate, frequency, startDate }, raw.first_number),
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      skippedNumbers: raw.skipped_numbers,
      startDate,
      status: RecurrenceStatus[raw.status],
      tags: toTagRefs(raw.tags),
      type: TransactionType[raw.type],
      updatedAt: raw.updated_at,
      value: raw.value,
    });
  }
}
