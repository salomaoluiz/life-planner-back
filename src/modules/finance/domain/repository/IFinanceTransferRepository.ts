import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransferEntity from '@finance/domain/entity/TransferEntity';

export interface TransferSide extends OwnerAccess {
  accountId: string;
  currency: string;
}

// The whole state of a transfer after the write; create and update both pass it (the use case merges a patch first).
export interface WriteTransferRepositoryParams {
  amountIn: null | number;
  amountOut: number;
  createdBy: string;
  dateIn: string;
  dateOut: string;
  description: string;
  fee: null | number;
  from: TransferSide;
  notes: null | string;
  occurrenceNumber?: null | number;
  paid: boolean;
  recurrenceId?: null | string;
  to: TransferSide;
}

export interface IFinanceTransferRepository {
  createTransfer(params: WriteTransferRepositoryParams): Promise<TransferEntity>;
  deleteTransfer(id: string): Promise<void>;
  findTransferById(id: string): Promise<TransferEntity | undefined>;
  findTransfersByIds(ids: string[]): Promise<TransferEntity[]>;
  updateTransfer(id: string, params: WriteTransferRepositoryParams): Promise<TransferEntity>;
}
