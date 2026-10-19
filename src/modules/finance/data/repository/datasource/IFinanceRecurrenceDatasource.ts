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
  create(params: CreateRecurrenceDatasourceParams): Promise<string>;
  findById(id: string): Promise<FinancialRecurrenceWithRelations | null>;
  findByOwners(
    owners: OwnerAccess[],
    filter?: FindRecurrencesDatasourceFilter,
  ): Promise<FinancialRecurrenceWithRelations[]>;
  findDue(owners: OwnerAccess[], horizon: Date): Promise<FinancialRecurrenceWithRelations[]>;
  findFutureNumbers(recurrenceIds: string[], afterDate: Date): Promise<FutureOccurrenceNumberRow[]>;
  findOccurrences(recurrenceId: string): Promise<FinancialTransactionWithRelations[]>;
  materialize(params: MaterializeRecurrenceDatasourceParams): Promise<void>;
}
export interface MaterializeRecurrenceDatasourceParams {
  expected_last: number;
  id: string;
  last_generated_number: number;
  next_occurrence_date: Date | null;
  rows: OccurrenceRowDatasourceParams[];
  status: RecurrenceStatus;
}
export interface OccurrenceRowDatasourceParams {
  date: Date;
  invoice_month?: string;
  number: number;
  paid?: boolean;
}
