import SplitEntity from '@finance/domain/entity/SplitEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionType } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// A part as written: `id` keeps a stored part (update in place), `description` null inherits the header's (FR 5).
export interface WriteSplitPartRepositoryParams {
  categoryId: string;
  description: null | string;
  id?: string;
  // Tag names; undefined keeps the stored tags of a kept part.
  tags?: string[];
  type: TransactionType;
  value: number;
}

// The whole state of a split after the write (the use case merges a patch first).
export interface WriteSplitRepositoryParams {
  accountId: null | string;
  createdBy: string;
  creditCardId: null | string;
  currency: CurrencyCode;
  date: string;
  description: string;
  invoiceMonth: null | string;
  notes: null | string;
  occurrenceNumber?: null | number;
  owner: OwnerType;
  ownerId: string;
  paid: boolean | null;
  parts: WriteSplitPartRepositoryParams[];
  recurrenceId?: null | string;
  // FR 16: the saved transaction that becomes the first part (it keeps its id).
  sourceTransactionId?: string;
}

// FR 22: one part left → the header is gone and the row is an ordinary transaction.
// The header and the totals of a split, without its rows (what a list needs to group the part rows, FR 27).
export interface IFinanceSplitRepository {
  createSplit(params: WriteSplitRepositoryParams): Promise<SplitEntity>;
  // CSV import: every split in ONE database transaction; returns how many were written.
  createSplits(params: WriteSplitRepositoryParams[]): Promise<number>;
  deleteSplit(id: string): Promise<void>;
  findSplitById(id: string): Promise<SplitEntity | undefined>;
  findSplitsByIds(ids: string[]): Promise<SplitEntity[]>;
  findSplitSummaries(ids: string[]): Promise<SplitSummary[]>;
  setSplitPaid(id: string, paid: boolean): Promise<SplitEntity>;
  updateSplit(id: string, params: WriteSplitRepositoryParams): Promise<UpdateSplitRepositoryResult>;
}
export interface SplitSummary {
  description: string;
  id: string;
  notes: null | string;
  occurrenceNumber: null | number;
  owner: OwnerType;
  ownerId: string;
  paid: boolean | null;
  partCount: number;
  recurrenceId: null | string;
  total: number;
  type: TransactionType;
}
export interface UpdateSplitRepositoryResult {
  dissolved?: TransactionEntity;
  split?: SplitEntity;
}
