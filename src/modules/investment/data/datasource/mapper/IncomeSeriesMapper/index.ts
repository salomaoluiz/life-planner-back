import { InvestmentIncomeSeries } from '@db/client';
import { toDecimalString } from '@investment/data/datasource/mapper/IncomeMapper';
import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { IncomeSeriesEntity } from '@investment/domain/entity/IncomeSeriesEntity';
import {
  IncomeSeriesEndReason,
  IncomeSeriesUnit,
  InvestmentIncomeType,
} from '@investment/domain/enum';

export class IncomeSeriesMapper {
  static toSeries(row: InvestmentIncomeSeries): IncomeSeriesEntity {
    return {
      accountId: row.account_id,
      amountPerUnit: toDecimalString(row.amount_per_unit),
      assetId: row.asset_id,
      categoryId: row.category_id,
      createdBy: row.created_by,
      currency: row.currency,
      endDate: row.end_date ? InvestmentMapper.toCalendarDate(row.end_date) : null,
      endedAt: row.ended_at ? InvestmentMapper.toCalendarDate(row.ended_at) : null,
      endReason: row.end_reason ? IncomeSeriesEndReason[row.end_reason] : null,
      exDateOffsetDays: row.ex_date_offset_days,
      firstNumber: row.first_number,
      firstPaymentDate: InvestmentMapper.toCalendarDate(row.first_payment_date),
      frequency: {
        interval: row.frequency_interval,
        unit: IncomeSeriesUnit[row.frequency_unit],
      },
      id: row.id,
      lastGeneratedNumber: row.last_generated_number,
      notes: row.notes,
      type: InvestmentIncomeType[row.type],
      withFinance: row.with_finance,
    };
  }
}
