import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { InvestmentAssetClass, InvestmentAssetStatus } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface AssetEntity {
  archivedAt: Date | null;
  assetClass: InvestmentAssetClass;
  createdAt: Date;
  currency: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: InvestmentAssetStatus;
  ticker: null | string;
}

// The detail: every operation (newest first) and every valuation (newest first).
export interface AssetDetail extends AssetEntity {
  operations: OperationEntity[];
  valuations: ValuationEntity[];
}

// The list item: operations feed the position, only the latest valuation is loaded.
export interface AssetListRow extends AssetEntity {
  latestValuation: null | ValuationEntity;
  operations: OperationEntity[];
}
