import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinancialTransferRecord } from '@finance/data/repository/datasource/IFinanceTransferDatasource';
import TransferEntity from '@finance/domain/entity/TransferEntity';

export class FinanceTransferMapper {
  static toDomain(record: FinancialTransferRecord): TransferEntity {
    return new TransferEntity({
      amountIn: record.amount_in,
      amountOut: record.amount_out,
      createdAt: record.created_at,
      createdBy: record.created_by,
      currencyIn: record.currency_in,
      currencyOut: record.currency_out,
      dateIn: toCalendarDate(record.date_in),
      dateOut: toCalendarDate(record.date_out),
      description: record.description,
      fee: record.fee,
      fromAccountId: record.from_account_id,
      id: record.id,
      notes: record.notes,
      occurrenceNumber: record.occurrence_number,
      paid: record.paid,
      recurrenceId: record.recurrence_id,
      rowIds: record.transactions.map((row) => row.id),
      toAccountId: record.to_account_id,
      updatedAt: record.updated_at,
    });
  }
}
