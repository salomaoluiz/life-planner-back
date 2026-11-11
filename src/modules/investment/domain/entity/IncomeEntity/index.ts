import {
  InvestmentAssetClass,
  InvestmentIncomeType,
  InvestmentSuggestionStatus,
} from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { PositionOperation } from '@investment/domain/service/PositionCalculator';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 107: money in integer minor units, quantities and prices as decimal strings, dates as `YYYY-MM-DD`.
// `accountId`, `categoryId` and `paid` come from the linked finance row.
export interface IncomeCategory {
  allScopes: boolean;
  archived: boolean;
  id: string;
  isIncome: boolean;
  isSystem: boolean;
  owner: null | OwnerType;
  ownerId: null | string;
  scopes: { owner: OwnerType; ownerId: string }[];
}
export interface IncomeEntity {
  accountId: null | string;
  amountPerUnit: null | string;
  assetClass: InvestmentAssetClass;
  assetId: string;
  categoryId: null | string;
  createdAt: Date;
  createdBy: string;
  currency: string;
  exDate: null | string;
  id: string;
  netAmount: number;
  notes: null | string;
  paid: boolean;
  paymentDate: string;
  quantity: null | string;
  suggestionId: null | string;
  transactionId: null | string;
  type: InvestmentIncomeType;
}
export interface IncomeEventEntity {
  amountPerUnit: string;
  currency: string;
  exDate: string;
  id: string;
  market: QuoteMarket;
  paymentDate: null | string;
  source: string;
  ticker: string;
  type: InvestmentIncomeType;
}
export interface IncomeEventUpsert {
  amountPerUnit: string;
  currency: string;
  eventKey: string;
  exDate: string;
  fetchedAt: Date;
  market: QuoteMarket;
  paymentDate: null | string;
  source: string;
  ticker: string;
  type: InvestmentIncomeType;
}
export interface IncomeFilter {
  assetId?: string;
  cursor?: { id: string; paymentDate: string };
  from?: string;
  limit: number;
  owners: { owner: OwnerType; ownerId: string }[];
  status?: 'PLANNED' | 'RECEIVED';
  to?: string;
  type?: InvestmentIncomeType;
}
export interface IncomeSuggestionEntity {
  assetId: string;
  event: IncomeEventEntity;
  eventId: string;
  id: string;
  quantity: string;
  status: InvestmentSuggestionStatus;
}
// What the matcher needs of an asset: its operations (for the position) and the quoted symbol.
export interface IncomeSuggestionAsset {
  assetClass: InvestmentAssetClass;
  assetId: string;
  market: QuoteMarket;
  operations: PositionOperation[];
  ticker: string;
}
export interface IncomeSuggestionInputs {
  assets: IncomeSuggestionAsset[];
  // `${assetId}:${eventId}` of every suggestion in any state.
  existing: string[];
  incomes: {
    assetId: string;
    exDate: null | string;
    paymentDate: string;
    type: InvestmentIncomeType;
  }[];
}
export interface IncomeSummaryTotals {
  planned: number;
  received: number;
}
export interface NewSuggestionRow {
  assetId: string;
  eventId: string;
  quantity: string;
}
// One write path for create, edit, receive and approve: `incomeId` set means update.
export interface WriteIncomeParams {
  accountId: string;
  amountPerUnit: null | string;
  assetId: string;
  // Description of the linked finance row: the ticker, or the name when there is none.
  assetLabel: string;
  categoryId: string;
  createdBy: string;
  currency: string;
  exDate: null | string;
  incomeId?: string;
  netAmount: number;
  notes: null | string;
  paid: boolean;
  paymentDate: string;
  quantity: null | string;
  suggestionId?: null | string;
  type: InvestmentIncomeType;
}
