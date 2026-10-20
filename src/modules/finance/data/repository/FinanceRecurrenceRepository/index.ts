import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceRecurrenceMapper } from '@finance/data/datasource/mapper/FinanceRecurrenceMapper';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import {
  IFinanceRecurrenceDatasource,
  NewSeriesDatasourceParams,
  OccurrenceRowDatasourceParams,
  SeriesPatchDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceRecurrenceDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  ApplyRecurrenceChangeRepositoryParams,
  CreateOccurrenceRepositoryParams,
  CreateRecurrenceRepositoryParams,
  FindRecurrencesFilter,
  FutureOccurrenceNumber,
  IFinanceRecurrenceRepository,
  MaterializeRecurrenceRepositoryParams,
  NewSeriesRepositoryParams,
  OccurrenceRow,
  RemoveRecurrenceRepositoryParams,
  RemoveRecurrenceResult,
  SeriesPatchRepositoryParams,
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
      series_patch: toSeriesPatch(seriesPatch),
      source_id: params.sourceId,
    });
  }

  async countBySource(source: { accountId?: string; creditCardId?: string }): Promise<number> {
    return this.recurrenceDatasource.countBySource({
      account_id: source.accountId,
      credit_card_id: source.creditCardId,
    });
  }

  async create(params: CreateRecurrenceRepositoryParams): Promise<string> {
    return this.recurrenceDatasource.create({
      account_id: params.accountId,
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      currency: params.currency,
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

  async createOccurrence(params: CreateOccurrenceRepositoryParams): Promise<TransactionEntity> {
    const row = await this.recurrenceDatasource.createOccurrence({
      category_id: params.categoryId,
      date: fromCalendarDate(params.date),
      description: params.description,
      invoice_month: params.invoiceMonth,
      number: params.number,
      paid: params.paid,
      recurrence_id: params.recurrenceId,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(row);
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.recurrenceDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
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
    series: { afterNumber: number; recurrenceId: string }[],
  ): Promise<FutureOccurrenceNumber[]> {
    const rows = await this.recurrenceDatasource.findFutureNumbers(
      series.map((item) => ({ after_number: item.afterNumber, recurrence_id: item.recurrenceId })),
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

  async removeFrom(params: RemoveRecurrenceRepositoryParams): Promise<RemoveRecurrenceResult> {
    return this.recurrenceDatasource.removeFrom({
      confirm_paid: params.confirmPaid,
      delete_series: params.deleteSeries,
      detach_locked: params.detachLocked,
      from_number: params.fromNumber,
      id: params.id,
      series_patch: params.seriesPatch ? toSeriesPatch(params.seriesPatch) : undefined,
    });
  }

  async skipNumber(id: string, occurrenceNumber: number): Promise<void> {
    await this.recurrenceDatasource.skipNumber(id, occurrenceNumber);
  }
}

// `undefined` leaves the column alone, `null` clears it.
function toNewSeries(series: NewSeriesRepositoryParams): NewSeriesDatasourceParams {
  return {
    account_id: series.accountId,
    category_id: series.categoryId,
    credit_card_id: series.creditCardId,
    currency: series.currency,
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
function toSeriesPatch(patch: SeriesPatchRepositoryParams): SeriesPatchDatasourceParams {
  return {
    account_id: patch.accountId,
    category_id: patch.categoryId,
    credit_card_id: patch.creditCardId,
    description: patch.description,
    end_date: toOptionalDate(patch.endDate),
    frequency: patch.frequency,
    last_generated_number: patch.lastGeneratedNumber,
    next_occurrence_date: toOptionalDate(patch.nextOccurrenceDate),
    skipped_numbers: patch.skippedNumbers,
    status: patch.status,
    value: patch.value,
  };
}
