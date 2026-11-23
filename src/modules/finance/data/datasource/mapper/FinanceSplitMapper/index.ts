import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import { FinancialSplitRecord } from '@finance/data/repository/datasource/IFinanceSplitDatasource';
import SplitEntity from '@finance/domain/entity/SplitEntity';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceSplitMapper {
  static toDomain(record: FinancialSplitRecord): SplitEntity {
    return new SplitEntity({
      accountId: record.account_id,
      createdAt: record.created_at,
      createdBy: record.created_by,
      creditCardId: record.credit_card_id,
      currency: record.currency as CurrencyCode,
      date: toCalendarDate(record.date),
      description: record.description,
      id: record.id,
      invoiceMonth: record.invoice_month,
      notes: record.notes,
      occurrenceNumber: record.occurrence_number,
      owner: OwnerType[record.owner],
      ownerId: record.owner_id,
      paid: record.paid,
      parts: record.transactions.map((row) => FinanceTransactionMapper.toDomain(row)),
      recurrenceId: record.recurrence_id,
      stockPurchaseId: record.stock_purchase_id,
      updatedAt: record.updated_at,
    });
  }
}
