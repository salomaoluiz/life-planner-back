import {
  FinancialCategory,
  FinancialCategoryScope,
  InvestmentAsset,
  InvestmentIncome,
  InvestmentIncomeEvent,
  InvestmentIncomeSuggestion,
} from '@db/client';
import {
  IncomeEventUpsert,
  IncomeFilter,
  WriteIncomeParams,
} from '@investment/domain/entity/IncomeEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type CategoryRow = { scopes: FinancialCategoryScope[] } & FinancialCategory;
export type IIncomeDatasource = {
  countPendingSuggestions(assetId: string): Promise<number>;
  createSuggestions(
    rows: { asset_id: string; event_id: string; quantity: string }[],
  ): Promise<number>;
  deleteIncome(id: string): Promise<void>;
  findCategoryById(id: string): Promise<CategoryRow | null>;
  findDefaultAccountId(assetId: string): Promise<null | string>;
  findEvents(
    keys: { market: string; ticker: string }[],
    sinceExDate: Date,
  ): Promise<InvestmentIncomeEvent[]>;
  findIncomeById(id: string): Promise<IncomeRow | null>;
  findIncomeByTransactionId(
    transactionId: string,
  ): Promise<null | Pick<InvestmentIncome, 'asset_id' | 'id'>>;
  findIncomes(filter: IncomeFilter): Promise<IncomeRow[]>;
  findLastIncomeCategoryId(owner: OwnerType, ownerId: string, type: string): Promise<null | string>;
  findPendingSuggestions(assetIds: string[]): Promise<SuggestionRow[]>;
  findSuggestionById(id: string): Promise<null | SuggestionRow>;
  findSuggestionInputs(keys: { market: string; ticker: string }[]): Promise<SuggestionInputsRow>;
  incomeTotals(
    assetId: string,
    yearFrom: Date,
    yearTo: Date,
  ): Promise<{ planned: number; received: number }>;
  rejectSuggestion(id: string, userId: string): Promise<void>;
  runExclusive(key: number, fn: () => Promise<void>): Promise<boolean>;
  upsertEvents(rows: IncomeEventUpsert[]): Promise<InvestmentIncomeEvent[]>;
  writeIncome(params: WriteIncomeParams): Promise<string>;
};
export type IncomeRow = {
  asset: Pick<InvestmentAsset, 'asset_class'>;
  transaction: { account_id: null | string; category_id: string; paid: boolean | null } | null;
} & InvestmentIncome;
export interface SuggestionInputsRow {
  assets: {
    asset_id: string;
    market: string;
    operations: {
      created_at: Date;
      date: Date;
      id: string;
      quantity: { toFixed(places: number): string };
      total: number;
      type: string;
    }[];
    ticker: string;
  }[];
  existing: { asset_id: string; event_id: string }[];
  incomes: Pick<InvestmentIncome, 'asset_id' | 'ex_date' | 'payment_date' | 'type'>[];
}
export type SuggestionRow = { event: InvestmentIncomeEvent } & InvestmentIncomeSuggestion;
