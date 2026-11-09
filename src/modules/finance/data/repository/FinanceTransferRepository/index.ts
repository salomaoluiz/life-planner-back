import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransferMapper } from '@finance/data/datasource/mapper/FinanceTransferMapper';
import {
  IFinanceTransferDatasource,
  WriteTransferDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceTransferDatasource';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import {
  CreateTransferSeriesRepositoryParams,
  DeleteTransferSeriesFromRepositoryParams,
  IFinanceTransferRepository,
  MaterializeTransferSeriesRepositoryParams,
  TransferSeriesTemplatePatch,
  WriteTransferRepositoryParams,
} from '@finance/domain/repository';
import { OwnerType, RecurrenceFrequency, RecurrenceStatus } from '@db/client';

function toDatasourceParams(params: WriteTransferRepositoryParams): WriteTransferDatasourceParams {
  const side = (item: WriteTransferRepositoryParams['from']) => ({
    account_id: item.accountId,
    currency: item.currency,
    owner: item.owner as OwnerType,
    owner_id: item.ownerId,
  });

  return {
    amount_in: params.amountIn,
    amount_out: params.amountOut,
    created_by: params.createdBy,
    date_in: fromCalendarDate(params.dateIn),
    date_out: fromCalendarDate(params.dateOut),
    description: params.description,
    fee: params.fee,
    from: side(params.from),
    notes: params.notes,
    occurrence_number: params.occurrenceNumber ?? null,
    paid: params.paid,
    recurrence_id: params.recurrenceId ?? null,
    to: side(params.to),
  };
}

@Injectable()
export class FinanceTransferRepository implements IFinanceTransferRepository {
  constructor(
    @Inject('IFinanceTransferDatasource')
    private readonly transferDatasource: IFinanceTransferDatasource,
  ) {}

  async createTransfer(params: WriteTransferRepositoryParams): Promise<TransferEntity> {
    return FinanceTransferMapper.toDomain(
      await this.transferDatasource.create(toDatasourceParams(params)),
    );
  }

  async createTransfers(params: WriteTransferRepositoryParams[]): Promise<number> {
    return this.transferDatasource.createMany(params.map((item) => toDatasourceParams(item)));
  }

  async createTransferSeries(
    params: CreateTransferSeriesRepositoryParams,
  ): Promise<TransferEntity> {
    return FinanceTransferMapper.toDomain(
      await this.transferDatasource.createSeries({
        end_date: params.endDate ? fromCalendarDate(params.endDate) : null,
        frequency: params.frequency as RecurrenceFrequency,
        last_generated_number: params.lastGeneratedNumber,
        next_occurrence_date: params.nextOccurrenceDate
          ? fromCalendarDate(params.nextOccurrenceDate)
          : null,
        occurrences: params.occurrences.map((occurrence) => toDatasourceParams(occurrence)),
        status: params.status as RecurrenceStatus,
      }),
    );
  }

  async deleteTransfer(id: string): Promise<void> {
    await this.transferDatasource.delete(id);
  }

  async deleteTransferSeriesFrom(params: DeleteTransferSeriesFromRepositoryParams): Promise<void> {
    await this.transferDatasource.deleteSeriesFrom({
      delete_series: params.deleteSeries,
      end_date: params.endDate ? fromCalendarDate(params.endDate) : null,
      from_number: params.fromNumber,
      last_generated_number: params.lastGeneratedNumber,
      recurrence_id: params.recurrenceId,
    });
  }

  async findSeriesTransfersFrom(
    recurrenceId: string,
    fromNumber: number,
  ): Promise<TransferEntity[]> {
    const records = await this.transferDatasource.findSeriesFrom(recurrenceId, fromNumber);

    return records.map((record) => FinanceTransferMapper.toDomain(record));
  }

  async findTransferById(id: string): Promise<TransferEntity | undefined> {
    const record = await this.transferDatasource.findById(id);

    return record ? FinanceTransferMapper.toDomain(record) : undefined;
  }

  async findTransfersByIds(ids: string[]): Promise<TransferEntity[]> {
    const records = await this.transferDatasource.findByIds(ids);

    return records.map((record) => FinanceTransferMapper.toDomain(record));
  }

  async materializeTransferSeries(
    params: MaterializeTransferSeriesRepositoryParams,
  ): Promise<void> {
    await this.transferDatasource.materializeSeries({
      expected_last: params.expectedLast,
      id: params.id,
      last_generated_number: params.lastGeneratedNumber,
      next_occurrence_date: params.nextOccurrenceDate
        ? fromCalendarDate(params.nextOccurrenceDate)
        : null,
      occurrences: params.occurrences.map((occurrence) => ({
        date: fromCalendarDate(occurrence.date),
        number: occurrence.number,
      })),
      status: params.status as RecurrenceStatus,
    });
  }

  async updateSeriesTemplate(
    recurrenceId: string,
    patch: TransferSeriesTemplatePatch,
  ): Promise<void> {
    await this.transferDatasource.updateSeriesTemplate(recurrenceId, {
      amount_in: patch.amountIn,
      description: patch.description,
      notes: patch.notes,
      value: patch.amountOut,
    });
  }

  async updateTransfer(id: string, params: WriteTransferRepositoryParams): Promise<TransferEntity> {
    return FinanceTransferMapper.toDomain(
      await this.transferDatasource.update(id, toDatasourceParams(params)),
    );
  }
}
