import { Injectable } from '@nestjs/common';

import {
  CreateTransferApiInput,
  TransferOutputItem,
  TransferWithRows,
  UpdateTransferApiInput,
} from '@api/finance/v1/dto/transfer.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { toTransactionItem, toTransactionLookups } from '@api/finance/v1/transaction.service';
import { CreateTransferUseCase } from '@finance/application/use-case/CreateTransferUseCase';
import { DeleteTransferUseCase } from '@finance/application/use-case/DeleteTransferUseCase';
import { GetTransactionByIdUseCase } from '@finance/application/use-case/GetTransactionByIdUseCase';
import { GetTransferUseCase } from '@finance/application/use-case/GetTransferUseCase';
import { UpdateTransferUseCase } from '@finance/application/use-case/UpdateTransferUseCase';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import { computeRate } from '@finance/domain/service/TransferRate';

function toTransferItem(transfer: TransferEntity): TransferOutputItem {
  return {
    amountIn: transfer.amountIn,
    amountOut: transfer.amountOut,
    currencyIn: transfer.currencyIn as TransferOutputItem['currencyIn'],
    currencyOut: transfer.currencyOut as TransferOutputItem['currencyOut'],
    dateIn: transfer.dateIn,
    dateOut: transfer.dateOut,
    description: transfer.description,
    fee: transfer.fee ?? undefined,
    fromAccountId: transfer.fromAccountId ?? undefined,
    id: transfer.id,
    notes: transfer.notes ?? undefined,
    occurrenceNumber: transfer.occurrenceNumber ?? undefined,
    paid: transfer.paid,
    // Only a transfer between different currencies has a rate worth showing.
    rate:
      transfer.currencyIn === transfer.currencyOut
        ? undefined
        : (computeRate(transfer.amountOut, transfer.amountIn) ?? undefined),
    recurrenceId: transfer.recurrenceId ?? undefined,
    toAccountId: transfer.toAccountId ?? undefined,
  };
}

export { toTransferItem };

@Injectable()
export class TransferService {
  constructor(
    private readonly createTransferUseCase: CreateTransferUseCase,
    private readonly deleteTransferUseCase: DeleteTransferUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getTransactionByIdUseCase: GetTransactionByIdUseCase,
    private readonly getTransferUseCase: GetTransferUseCase,
    private readonly updateTransferUseCase: UpdateTransferUseCase,
  ) {}

  async create(userId: string, input: CreateTransferApiInput): Promise<TransferWithRows> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const transfer = await this.createTransferUseCase.execute({
      ...input,
      accessibleOwners,
      requesterId: userId,
    });

    return this.toResponse(accessibleOwners, transfer);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteTransferUseCase.execute({ accessibleOwners, id });
  }

  async findById(userId: string, id: string): Promise<TransferWithRows> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const transfer = await this.getTransferUseCase.execute({ accessibleOwners, id });

    return this.toResponse(accessibleOwners, transfer);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateTransferApiInput,
  ): Promise<TransferWithRows> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const transfer = await this.updateTransferUseCase.execute({ ...input, accessibleOwners, id });

    return this.toResponse(accessibleOwners, transfer);
  }

  private async toResponse(
    accessibleOwners: OwnerAccess[],
    transfer: TransferEntity,
  ): Promise<TransferWithRows> {
    const rows = await Promise.all(
      transfer.rowIds.map((id) => this.getTransactionByIdUseCase.execute({ accessibleOwners, id })),
    );

    return {
      item: toTransferItem(transfer),
      lookups: toTransactionLookups(rows),
      rows: rows.map((row) => toTransactionItem(row)),
    };
  }
}
