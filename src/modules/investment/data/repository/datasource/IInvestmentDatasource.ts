import {
  FinancialAccount,
  InvestmentAsset,
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentOperation,
  InvestmentOperationFee,
  InvestmentOperationType,
  InvestmentValuation,
  OwnerType,
} from '@db/client';
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
export interface IInvestmentDatasource {
  createAsset(params: CreateAssetDatasourceParams): Promise<InvestmentAsset>;
  deleteAsset(id: string): Promise<void>;
  deleteAssetsByOwner(owner: OwnerType, ownerId: string): Promise<number>;
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
  writeOperation(params: WriteOperationDatasourceParams): Promise<string>;
}
export type OperationRow = { fees: InvestmentOperationFee[] } & InvestmentOperation;

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
export interface WriteOperationDatasourceParams {
  account_id: null | string;
  asset_id: string;
  asset_label: string;
  currency: string;
  date: Date;
  fees: { amount: number; description: null | string; kind: InvestmentOperationFee['kind'] }[];
  fees_total: number;
  generate_transaction: boolean;
  gross: number;
  // Set when editing.
  operation_id?: string;
  quantity: string;
  total: number;
  type: InvestmentOperationType;
  unit_price: string;
}
