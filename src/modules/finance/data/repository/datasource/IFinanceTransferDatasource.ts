import { OwnerType, RecurrenceFrequency, RecurrenceStatus } from '@db/client';

export interface FinancialTransferRecord {
  amount_in: null | number;
  amount_out: number;
  created_at: Date;
  created_by: string;
  currency_in: string;
  currency_out: string;
  date_in: Date;
  date_out: Date;
  description: string;
  fee: null | number;
  from_account_id: null | string;
  id: string;
  notes: null | string;
  occurrence_number: null | number;
  paid: boolean;
  recurrence_id: null | string;
  to_account_id: null | string;
  transactions: { category_id: string; id: string }[];
  updated_at: Date;
}
export interface TransferSideRecord {
  account_id: string;
  currency: string;
  owner: OwnerType;
  owner_id: string;
}
export interface WriteTransferDatasourceParams {
  amount_in: null | number;
  amount_out: number;
  created_by: string;
  date_in: Date;
  date_out: Date;
  description: string;
  fee: null | number;
  from: TransferSideRecord;
  notes: null | string;
  occurrence_number: null | number;
  paid: boolean;
  recurrence_id: null | string;
  to: TransferSideRecord;
}

// Spec 098 FR 8: the first transfers of a new series (occurrence numbers set by the caller, the first one is the
// user's) and where the series stands afterwards.
export interface CreateTransferSeriesDatasourceParams {
  end_date: Date | null;
  frequency: RecurrenceFrequency;
  last_generated_number: number;
  next_occurrence_date: Date | null;
  occurrences: WriteTransferDatasourceParams[];
  status: RecurrenceStatus;
}
export interface DeleteTransferSeriesFromDatasourceParams {
  delete_series: boolean;
  end_date: Date | null;
  from_number: number;
  last_generated_number: number;
  recurrence_id: string;
}
export interface IFinanceTransferDatasource {
  create(params: WriteTransferDatasourceParams): Promise<FinancialTransferRecord>;
  createMany(params: WriteTransferDatasourceParams[]): Promise<number>;
  createSeries(params: CreateTransferSeriesDatasourceParams): Promise<FinancialTransferRecord>;
  delete(id: string): Promise<void>;
  deleteSeriesFrom(params: DeleteTransferSeriesFromDatasourceParams): Promise<void>;
  findById(id: string): Promise<FinancialTransferRecord | null>;
  findByIds(ids: string[]): Promise<FinancialTransferRecord[]>;
  findSeriesFrom(recurrenceId: string, fromNumber: number): Promise<FinancialTransferRecord[]>;
  materializeSeries(params: MaterializeTransferSeriesDatasourceParams): Promise<void>;
  update(id: string, params: WriteTransferDatasourceParams): Promise<FinancialTransferRecord>;
  updateSeriesTemplate(
    recurrenceId: string,
    patch: UpdateTransferSeriesTemplateDatasourceParams,
  ): Promise<void>;
}
export interface MaterializeTransferSeriesDatasourceParams {
  expected_last: number;
  id: string;
  last_generated_number: number;
  next_occurrence_date: Date | null;
  // Unpaid transfers of the series template; the amount in is the series' (null for different currencies).
  occurrences: { date: Date; number: number }[];
  status: RecurrenceStatus;
}
export interface UpdateTransferSeriesTemplateDatasourceParams {
  amount_in?: null | number;
  description?: string;
  notes?: null | string;
  value?: number;
}
