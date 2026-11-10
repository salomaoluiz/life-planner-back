import { AssetDetail, AssetEntity, AssetListRow } from '@investment/domain/entity/AssetEntity';
import { FeeInput, OperationEntity } from '@investment/domain/entity/OperationEntity';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

export interface CreateAssetRepositoryParams {
  assetClass: InvestmentAssetClass;
  currency: string;
  initialValuation?: { date: string; unitPrice: Decimal8 };
  name: string;
  owner: OwnerType;
  ownerId: string;
  ticker: null | string;
}
export type IInvestmentRepository = {
  createAsset(params: CreateAssetRepositoryParams): Promise<AssetEntity>;
  // Deletes the asset, its operations, fees, valuations and the linked finance rows in one transaction.
  deleteAsset(id: string): Promise<void>;
  // Same for every asset of the owner; idempotent, returns the assets deleted.
  deleteAssetsByOwner(access: Pick<OwnerAccess, 'owner' | 'ownerId'>): Promise<number>;
  deleteOperation(id: string): Promise<void>;
  deleteValuation(id: string): Promise<void>;
  existsByOwner(access: Pick<OwnerAccess, 'owner' | 'ownerId'>): Promise<boolean>;
  findAccountForOperation(id: string): Promise<OperationAccount | undefined>;
  findAssetById(id: string): Promise<AssetDetail | undefined>;
  findAssetByTicker(
    owner: OwnerType,
    ownerId: string,
    ticker: string,
  ): Promise<AssetEntity | undefined>;
  findAssetsByOwners(owners: OwnerAccess[], status: InvestmentAssetStatus): Promise<AssetListRow[]>;
  findOperationById(id: string): Promise<OperationEntity | undefined>;
  findOperationByTransactionId(
    transactionId: string,
  ): Promise<{ assetId: string; operationId: string } | undefined>;
  findValuationById(id: string): Promise<undefined | ValuationEntity>;
  updateAsset(params: UpdateAssetRepositoryParams): Promise<AssetEntity>;
  upsertValuation(params: UpsertValuationRepositoryParams): Promise<ValuationEntity>;
  // One database transaction: operation, fees, linked finance row, ledger balance and the never-negative check.
  // Throws `NegativePositionError` (and writes nothing) when the position would go below zero.
  writeOperation(params: WriteOperationRepositoryParams): Promise<string>;
};
export interface OperationAccount {
  archived: boolean;
  currency: string;
  id: string;
  owner: OwnerType;
  ownerId: string;
}

// `undefined` = unchanged, `null` = clear.
export interface UpdateAssetRepositoryParams {
  archivedAt?: Date | null;
  assetClass?: InvestmentAssetClass;
  currency?: string;
  id: string;
  name?: string;
  owner?: OwnerType;
  ownerId?: string;
  status?: InvestmentAssetStatus;
  ticker?: null | string;
}
export interface UpsertValuationRepositoryParams {
  assetId: string;
  date: string;
  unitPrice: Decimal8;
}
export interface WriteOperationRepositoryParams {
  accountId: null | string;
  assetId: string;
  // Description of the linked finance row: the ticker, or the name when there is none.
  assetLabel: string;
  currency: string;
  date: string;
  fees: FeeInput[];
  feesTotal: number;
  // BRL per USD as a decimal string; null when the asset is in BRL or the rate is unknown.
  fxRate: null | string;
  generateTransaction: boolean;
  gross: number;
  // Set when editing.
  operationId?: string;
  quantity: Decimal8;
  total: number;
  type: InvestmentOperationType;
  unitPrice: Decimal8;
}
