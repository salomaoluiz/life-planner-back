import { OwnerType } from '@db/client';

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

export interface IFinanceTransferDatasource {
  create(params: WriteTransferDatasourceParams): Promise<FinancialTransferRecord>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<FinancialTransferRecord | null>;
  findByIds(ids: string[]): Promise<FinancialTransferRecord[]>;
  update(id: string, params: WriteTransferDatasourceParams): Promise<FinancialTransferRecord>;
}
