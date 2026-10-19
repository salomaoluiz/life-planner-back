import {
  FinancialAccount,
  FinancialCategory,
  FinancialCreditCard,
  FinancialRecurrence,
  OwnerType,
  RecurrenceFrequency,
  RecurrenceStatus,
  TransactionType,
} from '@db/client';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export interface ApplyRecurrenceChangeDatasourceParams {
  delete_after?: Date | null;
  from_number: number;
  new_series?: NewSeriesDatasourceParams | null;
  replace_rows?: null | OccurrenceRowDatasourceParams[];
  row_patch: RowPatchDatasourceParams;
  series_patch: SeriesPatchDatasourceParams;
  source_id: string;
}
export interface CreateOccurrenceDatasourceParams {
  category_id?: string;
  date: Date;
  description?: string;
  invoice_month?: string;
  number: number;
  paid?: boolean;
  recurrence_id: string;
  value?: number;
}
export interface CreateRecurrenceDatasourceParams {
  account_id?: string;
  category_id: string;
  credit_card_id?: string;
  description: string;
  end_date: Date | null;
  frequency: RecurrenceFrequency;
  last_generated_number: number;
  next_occurrence_date: Date | null;
  owner: OwnerType;
  owner_id: string;
  rows: OccurrenceRowDatasourceParams[];
  start_date: Date;
  status: RecurrenceStatus;
  type: TransactionType;
  value: number;
}
export type FinancialRecurrenceWithRelations = {
  account: null | Pick<FinancialAccount, 'icon' | 'id' | 'name'>;
  category: Pick<
    FinancialCategory,
    'exclude_from_totals' | 'icon_color' | 'icon' | 'id' | 'name' | 'system_key'
  >;
  credit_card: null | Pick<FinancialCreditCard, 'color' | 'id' | 'last_digits' | 'title'>;
} & FinancialRecurrence;
export interface FindRecurrencesDatasourceFilter {
  account_id?: string;
  credit_card_id?: string;
  status?: RecurrenceStatus;
}
export interface FutureOccurrenceNumberRow {
  occurrence_number: number;
  recurrence_id: string;
}
export interface IFinanceRecurrenceDatasource {
  apply(params: ApplyRecurrenceChangeDatasourceParams): Promise<string>;
  countBySource(source: { account_id?: string; credit_card_id?: string }): Promise<number>;
  create(params: CreateRecurrenceDatasourceParams): Promise<string>;
  createOccurrence(
    params: CreateOccurrenceDatasourceParams,
  ): Promise<FinancialTransactionWithRelations>;
  exists(access: { owner: OwnerType; owner_id: string }): Promise<boolean>;
  findById(id: string): Promise<FinancialRecurrenceWithRelations | null>;
  findByOwners(
    owners: OwnerAccess[],
    filter?: FindRecurrencesDatasourceFilter,
  ): Promise<FinancialRecurrenceWithRelations[]>;
  findDue(owners: OwnerAccess[], horizon: Date): Promise<FinancialRecurrenceWithRelations[]>;
  findFutureNumbers(
    series: { after_number: number; recurrence_id: string }[],
  ): Promise<FutureOccurrenceNumberRow[]>;
  findOccurrences(recurrenceId: string): Promise<FinancialTransactionWithRelations[]>;
  materialize(params: MaterializeRecurrenceDatasourceParams): Promise<void>;
  removeFrom(params: RemoveRecurrenceDatasourceParams): Promise<RemoveRecurrenceDatasourceResult>;
  skipNumber(id: string, occurrenceNumber: number): Promise<void>;
}
export interface MaterializeRecurrenceDatasourceParams {
  expected_last: number;
  id: string;
  last_generated_number: number;
  next_occurrence_date: Date | null;
  rows: OccurrenceRowDatasourceParams[];
  status: RecurrenceStatus;
}
export interface NewSeriesDatasourceParams {
  account_id?: string;
  category_id: string;
  credit_card_id?: string;
  description: string;
  end_date: Date | null;
  first_number: number;
  frequency: RecurrenceFrequency;
  last_generated_number: number;
  next_occurrence_date: Date | null;
  owner: OwnerType;
  owner_id: string;
  skipped_numbers: number[];
  start_date: Date;
  status: RecurrenceStatus;
  type: TransactionType;
  value: number;
}
export interface OccurrenceRowDatasourceParams {
  date: Date;
  invoice_month?: string;
  number: number;
  paid?: boolean;
}
export interface RemoveRecurrenceDatasourceParams {
  confirm_paid: boolean;
  delete_series: boolean;
  detach_locked: boolean;
  from_number: number;
  id: string;
  series_patch?: SeriesPatchDatasourceParams;
}
export interface RemoveRecurrenceDatasourceResult {
  deleted: number;
  detached: number;
}
export interface RowPatchDatasourceParams {
  account_id?: string;
  category_id?: string;
  credit_card_id?: string;
  description?: string;
  invoice_months?: { id: string; invoice_month: string }[];
  value?: number;
}
export interface SeriesPatchDatasourceParams {
  account_id?: string;
  category_id?: string;
  credit_card_id?: string;
  description?: string;
  end_date?: Date | null;
  frequency?: RecurrenceFrequency;
  last_generated_number?: number;
  next_occurrence_date?: Date | null;
  skipped_numbers?: number[];
  status?: RecurrenceStatus;
  value?: number;
}
