import { InvestmentAsset, InvestmentValuation } from '@db/client';
import { OperationRow } from '@investment/data/repository/datasource/IInvestmentDatasource';
import { AssetEntity } from '@investment/domain/entity/AssetEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentFeeKind,
  InvestmentOperationType,
  InvestmentValuationSource,
} from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

export class InvestmentMapper {
  // `YYYY-MM-DD` -> the UTC midnight Date a `@db.Date` column takes.
  static fromCalendarDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  // A Prisma `Decimal` (numeric(x,8)) -> exact decimal.
  static toAsset(row: InvestmentAsset): AssetEntity {
    return {
      archivedAt: row.archived_at,
      assetClass: InvestmentAssetClass[row.asset_class],
      createdAt: row.created_at,
      currency: row.currency,
      id: row.id,
      name: row.name,
      owner: OwnerType[row.owner],
      ownerId: row.owner_id,
      status: InvestmentAssetStatus[row.status],
      ticker: row.ticker,
    };
  }

  static toCalendarDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  static toDecimal(value: { toFixed(places: number): string }): Decimal8 {
    return Decimal8.parse(value.toFixed(8));
  }

  static toOperation(row: OperationRow): OperationEntity {
    return {
      accountId: row.account_id,
      assetId: row.asset_id,
      createdAt: row.created_at,
      date: InvestmentMapper.toCalendarDate(row.date),
      fees: row.fees.map((fee) => ({
        amount: fee.amount,
        description: fee.description,
        id: fee.id,
        kind: InvestmentFeeKind[fee.kind],
      })),
      feesTotal: row.fees_total,
      fxRate: row.fx_rate ? row.fx_rate.toFixed(6) : null,
      generateTransaction: row.generate_transaction,
      gross: row.gross,
      id: row.id,
      quantity: InvestmentMapper.toDecimal(row.quantity),
      total: row.total,
      transactionId: row.transaction_id,
      type: InvestmentOperationType[row.type],
      unitPrice: InvestmentMapper.toDecimal(row.unit_price),
    };
  }

  static toValuation(row: InvestmentValuation): ValuationEntity {
    return {
      assetId: row.asset_id,
      date: InvestmentMapper.toCalendarDate(row.date),
      id: row.id,
      source: InvestmentValuationSource[row.source],
      unitPrice: InvestmentMapper.toDecimal(row.unit_price),
    };
  }
}
