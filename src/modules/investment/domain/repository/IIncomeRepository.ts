import {
  IncomeCategory,
  IncomeEntity,
  IncomeEventEntity,
  IncomeEventUpsert,
  IncomeFilter,
  IncomeSuggestionEntity,
  IncomeSuggestionInputs,
  IncomeSummaryTotals,
  NewSuggestionRow,
  WriteIncomeParams,
} from '@investment/domain/entity/IncomeEntity';
import { InvestmentIncomeType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 107. Every write runs in ONE database transaction with the finance row and the account ledger.
export type IIncomeRepository = {
  countPendingSuggestions(assetId: string): Promise<number>;
  createSuggestions(rows: NewSuggestionRow[]): Promise<number>;
  // Removes the income and its finance row (ledger adjusted when it was paid); a suggestion becomes DISMISSED.
  deleteIncome(id: string): Promise<void>;
  // The account of the earliest BUY of the asset that has a finance row.
  findCategoryById(id: string): Promise<IncomeCategory | undefined>;
  findDefaultAccountId(assetId: string): Promise<string | undefined>;
  findEvents(
    keys: { market: QuoteMarket; ticker: string }[],
    sinceExDate: string,
  ): Promise<IncomeEventEntity[]>;
  findIncomeById(id: string): Promise<IncomeEntity | undefined>;
  findIncomeByTransactionId(
    transactionId: string,
  ): Promise<{ assetId: string; incomeId: string } | undefined>;
  findIncomes(filter: IncomeFilter): Promise<IncomeEntity[]>;
  // The category of the most recent income of the type in the owner (any asset).
  findLastIncomeCategoryId(
    owner: OwnerType,
    ownerId: string,
    type: InvestmentIncomeType,
  ): Promise<string | undefined>;
  findPendingSuggestions(assetIds: string[]): Promise<IncomeSuggestionEntity[]>;
  findSuggestionById(id: string): Promise<IncomeSuggestionEntity | undefined>;
  findSuggestionInputs(
    keys: { market: QuoteMarket; ticker: string }[],
  ): Promise<IncomeSuggestionInputs>;
  incomeTotals(assetId: string, yearFrom: string, yearTo: string): Promise<IncomeSummaryTotals>;
  rejectSuggestion(id: string, userId: string): Promise<void>;
  // Runs `fn` only when no other instance holds the advisory lock; false when skipped.
  runExclusive(key: number, fn: () => Promise<void>): Promise<boolean>;
  upsertEvents(rows: IncomeEventUpsert[]): Promise<IncomeEventEntity[]>;
  writeIncome(params: WriteIncomeParams): Promise<string>;
};
