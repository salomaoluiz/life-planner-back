import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransferEntity from '@finance/domain/entity/TransferEntity';
import { RecurrenceFrequency, RecurrenceStatus } from '@finance/domain/enum';

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

// Spec 098 FR 8: a new transfer series and its first occurrences (the first is the user's, numbered 1).
export interface CreateTransferSeriesRepositoryParams {
  endDate: null | string;
  frequency: RecurrenceFrequency;
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  occurrences: WriteTransferRepositoryParams[];
  status: RecurrenceStatus;
}

export interface MaterializeTransferSeriesRepositoryParams {
  expectedLast: number;
  id: string;
  lastGeneratedNumber: number;
  nextOccurrenceDate: null | string;
  occurrences: { date: string; number: number }[];
  status: RecurrenceStatus;
}

export interface IFinanceTransferRepository {
  createTransfer(params: WriteTransferRepositoryParams): Promise<TransferEntity>;
  createTransferSeries(params: CreateTransferSeriesRepositoryParams): Promise<TransferEntity>;
  deleteTransfer(id: string): Promise<void>;
  findTransferById(id: string): Promise<TransferEntity | undefined>;
  findTransfersByIds(ids: string[]): Promise<TransferEntity[]>;
  materializeTransferSeries(params: MaterializeTransferSeriesRepositoryParams): Promise<void>;
  updateTransfer(id: string, params: WriteTransferRepositoryParams): Promise<TransferEntity>;
}
