import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceRecurrenceMapper } from '@finance/data/datasource/mapper/FinanceRecurrenceMapper';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import {
  IFinanceRecurrenceDatasource,
  NewSeriesDatasourceParams,
  OccurrenceRowDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceRecurrenceDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  ApplyRecurrenceChangeRepositoryParams,
  CreateRecurrenceRepositoryParams,
  FindRecurrencesFilter,
  FutureOccurrenceNumber,
  IFinanceRecurrenceRepository,
  MaterializeRecurrenceRepositoryParams,
  NewSeriesRepositoryParams,
  OccurrenceRow,
} from '@finance/domain/repository';

@Injectable()
export class FinanceRecurrenceRepository implements IFinanceRecurrenceRepository {
  constructor(
    @Inject('IFinanceRecurrenceDatasource')
    private readonly recurrenceDatasource: IFinanceRecurrenceDatasource,
  ) {}

  async applyChange(params: ApplyRecurrenceChangeRepositoryParams): Promise<string> {
    const { rowPatch, seriesPatch } = params;

    return this.recurrenceDatasource.apply({
      delete_after: toOptionalDate(params.deleteAfter),
      from_number: params.fromNumber,
      new_series: params.newSeries ? toNewSeries(params.newSeries) : null,
      replace_rows: params.replaceRows ? params.replaceRows.map(toRow) : null,
      row_patch: {
        account_id: rowPatch.accountId,
        category_id: rowPatch.categoryId,
        credit_card_id: rowPatch.creditCardId,
        description: rowPatch.description,
        invoice_months: rowPatch.invoiceMonths?.map((item) => ({
          id: item.id,
          invoice_month: item.invoiceMonth,
        })),
        value: rowPatch.value,
      },
      series_patch: {
        account_id: seriesPatch.accountId,
        category_id: seriesPatch.categoryId,
        credit_card_id: seriesPatch.creditCardId,
        description: seriesPatch.description,
        end_date: toOptionalDate(seriesPatch.endDate),
        frequency: seriesPatch.frequency,
        last_generated_number: seriesPatch.lastGeneratedNumber,
        next_occurrence_date: toOptionalDate(seriesPatch.nextOccurrenceDate),
        skipped_numbers: seriesPatch.skippedNumbers,
        status: seriesPatch.status,
        value: seriesPatch.value,
      },
      source_id: params.sourceId,
    });
  }

  async create(params: CreateRecurrenceRepositoryParams): Promise<string> {
    return this.recurrenceDatasource.create({
      account_id: params.accountId,
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      description: params.description,
      end_date: params.endDate ? fromCalendarDate(params.endDate) : null,
      frequency: params.frequency,
      last_generated_number: params.lastGeneratedNumber,
      next_occurrence_date: toNullableDate(params.nextOccurrenceDate),
      owner: params.owner,
      owner_id: params.ownerId,
      rows: params.rows.map(toRow),
      start_date: fromCalendarDate(params.startDate),
      status: params.status,
      type: params.type,
      value: params.value,
    });
  }

  async findById(id: string): Promise<RecurrenceEntity | undefined> {
    const result = await this.recurrenceDatasource.findById(id);

    return result ? FinanceRecurrenceMapper.toDomain(result) : undefined;
  }

  async findByOwners(
    owners: OwnerAccess[],
    filter: FindRecurrencesFilter = {},
  ): Promise<RecurrenceEntity[]> {
    const result = await this.recurrenceDatasource.findByOwners(owners, {
      account_id: filter.accountId,
      credit_card_id: filter.creditCardId,
      status: filter.status,
    });

    return result.map((row) => FinanceRecurrenceMapper.toDomain(row));
  }

  async findDue(owners: OwnerAccess[], horizon: string): Promise<RecurrenceEntity[]> {
    const result = await this.recurrenceDatasource.findDue(owners, fromCalendarDate(horizon));

    return result.map((row) => FinanceRecurrenceMapper.toDomain(row));
  }

  async findFutureNumbers(
    recurrenceIds: string[],
    afterDate: string,
  ): Promise<FutureOccurrenceNumber[]> {
    const rows = await this.recurrenceDatasource.findFutureNumbers(
      recurrenceIds,
      fromCalendarDate(afterDate),
    );

    return rows.map((row) => ({
      occurrenceNumber: row.occurrence_number,
      recurrenceId: row.recurrence_id,
    }));
  }

  async findOccurrences(recurrenceId: string): Promise<TransactionEntity[]> {
    const rows = await this.recurrenceDatasource.findOccurrences(recurrenceId);

    return rows.map((row) => FinanceTransactionMapper.toDomain(row));
  }

  async materialize(params: MaterializeRecurrenceRepositoryParams): Promise<void> {
    await this.recurrenceDatasource.materialize({
      expected_last: params.expectedLast,
      id: params.id,
      last_generated_number: params.lastGeneratedNumber,
      next_occurrence_date: toNullableDate(params.nextOccurrenceDate),
      rows: params.rows.map(toRow),
      status: params.status,
    });
  }
}

// `undefined` leaves the column alone, `null` clears it.
function toNewSeries(series: NewSeriesRepositoryParams): NewSeriesDatasourceParams {
  return {
    account_id: series.accountId,
    category_id: series.categoryId,
    credit_card_id: series.creditCardId,
    description: series.description,
    end_date: toNullableDate(series.endDate),
    first_number: series.firstNumber,
    frequency: series.frequency,
    last_generated_number: series.lastGeneratedNumber,
    next_occurrence_date: toNullableDate(series.nextOccurrenceDate),
    owner: series.owner,
    owner_id: series.ownerId,
    skipped_numbers: series.skippedNumbers,
    start_date: fromCalendarDate(series.startDate),
    status: series.status,
    type: series.type,
    value: series.value,
  };
}
function toNullableDate(value: null | string): Date | null {
  return value ? fromCalendarDate(value) : null;
}
function toOptionalDate(value?: null | string): Date | null | undefined {
  return value === undefined ? undefined : toNullableDate(value);
}
function toRow(row: OccurrenceRow): OccurrenceRowDatasourceParams {
  return {
    date: fromCalendarDate(row.date),
    invoice_month: row.invoiceMonth,
    number: row.number,
    paid: row.paid,
  };
}
