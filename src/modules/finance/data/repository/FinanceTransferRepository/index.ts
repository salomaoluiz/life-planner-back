import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransferMapper } from '@finance/data/datasource/mapper/FinanceTransferMapper';
import {
  IFinanceTransferDatasource,
  WriteTransferDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceTransferDatasource';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import {
  IFinanceTransferRepository,
  WriteTransferRepositoryParams,
} from '@finance/domain/repository';
import { OwnerType } from '@db/client';

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

  async deleteTransfer(id: string): Promise<void> {
    await this.transferDatasource.delete(id);
  }

  async findTransferById(id: string): Promise<TransferEntity | undefined> {
    const record = await this.transferDatasource.findById(id);

    return record ? FinanceTransferMapper.toDomain(record) : undefined;
  }

  async updateTransfer(id: string, params: WriteTransferRepositoryParams): Promise<TransferEntity> {
    return FinanceTransferMapper.toDomain(
      await this.transferDatasource.update(id, toDatasourceParams(params)),
    );
  }
}
