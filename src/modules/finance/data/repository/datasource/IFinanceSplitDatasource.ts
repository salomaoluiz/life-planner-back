import { FinancialSplit, OwnerType } from '@db/client';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { TransactionType } from '@finance/domain/enum';

export type FinancialSplitRecord = {
  transactions: FinancialTransactionWithRelations[];
} & FinancialSplit;
export type FinancialSplitSummaryRecord = {
  transactions: { type: TransactionType; value: number }[];
} & FinancialSplit;
export interface IFinanceSplitDatasource {
  create(params: WriteSplitDatasourceParams): Promise<FinancialSplitRecord>;
  createMany(params: WriteSplitDatasourceParams[]): Promise<number>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<FinancialSplitRecord | null>;
  findByIds(ids: string[]): Promise<FinancialSplitRecord[]>;
  findSummaries(ids: string[]): Promise<FinancialSplitSummaryRecord[]>;
  setPaid(id: string, paid: boolean): Promise<FinancialSplitRecord>;
  update(id: string, params: WriteSplitDatasourceParams): Promise<UpdateSplitDatasourceResult>;
}
export interface UpdateSplitDatasourceResult {
  // Set when the write left one part (FR 22): the id of the row that became an ordinary transaction.
  dissolved_id?: string;
  split?: FinancialSplitRecord;
}
export interface WriteSplitDatasourceParams {
  account_id: null | string;
  created_by: string;
  credit_card_id: null | string;
  currency: string;
  date: Date;
  description: string;
  invoice_month: null | string;
  notes: null | string;
  occurrence_number: null | number;
  owner: OwnerType;
  owner_id: string;
  paid: boolean | null;
  parts: WriteSplitPartDatasourceParams[];
  recurrence_id: null | string;
  source_transaction_id?: string;
}
export interface WriteSplitPartDatasourceParams {
  category_id: string;
  // Null inherits the header description (stored on the row with `description_inherited`).
  description: null | string;
  id?: string;
  tag_names?: string[];
  type: TransactionType;
  value: number;
}
