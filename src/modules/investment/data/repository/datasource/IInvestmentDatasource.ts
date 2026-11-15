import {
  FinancialAccount,
  InvestmentAsset,
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentFixedIncomeAdjustment,
  InvestmentFixedIncomeRate,
  InvestmentFixedIncomeRedemptionKind,
  InvestmentFixedIncomeTerms,
  InvestmentOperation,
  InvestmentOperationFee,
  InvestmentOperationType,
  InvestmentValuation,
  OwnerType,
} from '@db/client';
import {
  FixedIncomeRateWrite,
  FixedIncomeTermsWrite,
} from '@investment/domain/entity/FixedIncomeEntity';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';

export interface CreateAssetDatasourceParams {
  asset_class: InvestmentAssetClass;
  currency: string;
  name: string;
  owner: OwnerType;
  owner_id: string;
  ticker: null | string;
  // First valuation, dated by the caller; `unit_price` is a decimal string.
  valuation?: { date: Date; unit_price: string };
}
export interface CreateFixedIncomeTitleDatasourceParams {
  asset: CreateAssetDatasourceParams;
  contribution: Omit<WriteOperationDatasourceParams, 'asset_id'>;
  rate: FixedIncomeRateWrite;
  terms: FixedIncomeTermsWrite;
}
export interface FixedIncomeRows {
  adjustments: InvestmentFixedIncomeAdjustment[];
  rates: InvestmentFixedIncomeRate[];
  terms: InvestmentFixedIncomeTerms[];
}
export interface IInvestmentDatasource {
  createAsset(params: CreateAssetDatasourceParams): Promise<InvestmentAsset>;
  createFixedIncomeRate(assetId: string, rate: FixedIncomeRateWrite): Promise<void>;
  createFixedIncomeTitle(
    params: CreateFixedIncomeTitleDatasourceParams,
  ): Promise<{ assetId: string; operationId: string }>;
  deleteAsset(id: string): Promise<void>;
  deleteAssetsByOwner(owner: OwnerType, ownerId: string): Promise<number>;
  deleteFixedIncomeAdjustment(assetId: string, id: string): Promise<void>;
  deleteFixedIncomeRate(assetId: string, id: string): Promise<void>;
  deleteOperation(id: string): Promise<void>;
  deleteValuation(id: string): Promise<void>;
  existsByOwner(owner: OwnerType, ownerId: string): Promise<boolean>;
  findAccountById(
    id: string,
  ): Promise<null | Pick<FinancialAccount, 'currency' | 'id' | 'owner_id' | 'owner' | 'status'>>;
  findAssetById(id: string): Promise<InvestmentAsset | null>;
  findAssetByTicker(
    owner: OwnerType,
    ownerId: string,
    ticker: string,
  ): Promise<InvestmentAsset | null>;
  findAssets(owners: OwnerAccess[], status: InvestmentAssetStatus): Promise<InvestmentAsset[]>;
  findFixedIncomeAdjustmentById(id: string): Promise<InvestmentFixedIncomeAdjustment | null>;
  findFixedIncomeByAssetIds(assetIds: string[]): Promise<FixedIncomeRows>;
  findFixedIncomeRateById(id: string): Promise<InvestmentFixedIncomeRate | null>;
  saveFixedIncomeTerms(params: SaveFixedIncomeTermsDatasourceParams): Promise<void>;
  updateFixedIncomeRate(assetId: string, id: string, rate: FixedIncomeRateWrite): Promise<void>;
  upsertFixedIncomeAdjustment(assetId: string, date: string, grossAmount: number): Promise<void>;
  // Newest first (date, created_at, id), fees included.
  findOperationById(id: string): Promise<null | OperationRow>;
  findOperationByTransactionId(
    transactionId: string,
  ): Promise<null | Pick<InvestmentOperation, 'asset_id' | 'id'>>;
  findOperationsByAssetIds(assetIds: string[]): Promise<OperationRow[]>;
  // The latest valuation of each asset (one query).
  findLatestValuations(assetIds: string[]): Promise<InvestmentValuation[]>;
  findValuationById(id: string): Promise<InvestmentValuation | null>;
  findValuationsByAssetId(assetId: string): Promise<InvestmentValuation[]>;
  updateAsset(params: UpdateAssetDatasourceParams): Promise<InvestmentAsset>;
  upsertValuation(assetId: string, date: Date, unitPrice: string): Promise<InvestmentValuation>;
  writeEvent(params: WriteEventDatasourceParams): Promise<string>;
  writeOperation(params: WriteOperationDatasourceParams): Promise<string>;
}
export type OperationRow = { fees: InvestmentOperationFee[] } & InvestmentOperation;
export interface SaveFixedIncomeTermsDatasourceParams {
  assetId: string;
  // Converting a manual asset also turns its operations into lots and redemptions (FR 4).
  convert: boolean;
  rate?: FixedIncomeRateWrite;
  terms: FixedIncomeTermsWrite;
}

// `undefined` = unchanged (Prisma no-op), `null` = set NULL.
export interface UpdateAssetDatasourceParams {
  archived_at?: Date | null;
  asset_class?: InvestmentAssetClass;
  currency?: string;
  id: string;
  name?: string;
  owner?: OwnerType;
  owner_id?: string;
  status?: InvestmentAssetStatus;
  ticker?: null | string;
}
// Spec 108: a split, reverse split or bonus. No finance row, no money fields.
export interface WriteEventDatasourceParams {
  asset_id: string;
  bonus_percent: null | string;
  bonus_unit_cost: null | string;
  date: Date;
  // Set when approving a suggestion.
  decided_by?: string;
  event_suggestion_id?: string;
  // Set when editing.
  operation_id?: string;
  ratio_from: null | string;
  ratio_to: null | string;
  type: InvestmentOperationType;
}
export interface WriteOperationDatasourceParams {
  account_id: null | string;
  asset_id: string;
  asset_label: string;
  currency: string;
  date: Date;
  fees: { amount: number; description: null | string; kind: InvestmentOperationFee['kind'] }[];
  fees_total: number;
  // BRL per USD (decimal string); null for BRL assets and operations without a rate.
  fx_rate: null | string;
  generate_transaction: boolean;
  gross: number;
  // Spec 108 FR 15: the event whose fraction this SELL sells.
  fraction_of_operation_id?: null | string;
  // Set when editing.
  operation_id?: string;
  quantity: string;
  total: number;
  type: InvestmentOperationType;
  unit_price: string;
  // Spec 105: set on SELL rows of calculated titles.
  net_amount?: null | number;
  redemption_kind?: InvestmentFixedIncomeRedemptionKind | null;
}
