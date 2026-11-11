import {
  InvestmentAsset,
  InvestmentFixedIncomeAdjustment,
  InvestmentFixedIncomeRate,
  InvestmentFixedIncomeTerms,
  InvestmentValuation,
} from '@db/client';
import { OperationRow } from '@investment/data/repository/datasource/IInvestmentDatasource';
import { AssetEntity } from '@investment/domain/entity/AssetEntity';
import {
  FixedIncomeAdjustmentEntity,
  FixedIncomeRateEntity,
  FixedIncomeTermsEntity,
} from '@investment/domain/entity/FixedIncomeEntity';
import { EventData, OperationEntity } from '@investment/domain/entity/OperationEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentFeeKind,
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
  InvestmentValuationSource,
} from '@investment/domain/enum';
import { PositionOperation } from '@investment/domain/service/PositionCalculator';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

type Dec = { toFixed(places: number): string };
// The columns a row needs to rebuild an event (spec 108).
export interface EventColumns {
  bonus_percent: Dec | null;
  bonus_unit_cost: Dec | null;
  ratio_from: Dec | null;
  ratio_to: Dec | null;
  type: keyof typeof InvestmentOperationType;
}
// The columns the position calculator reads from an operation row.
export interface PositionColumns extends EventColumns {
  created_at: Date;
  date: Date;
  fraction_of_operation_id: null | string;
  id: string;
  quantity: Dec | null;
  total: null | number;
}

// What a transaction selects to rebuild the position of an asset.
export const POSITION_SELECT = {
  bonus_percent: true,
  bonus_unit_cost: true,
  created_at: true,
  date: true,
  fraction_of_operation_id: true,
  id: true,
  quantity: true,
  ratio_from: true,
  ratio_to: true,
  total: true,
  type: true,
} as const;

export class InvestmentMapper {
  // `YYYY-MM-DD` -> the UTC midnight Date a `@db.Date` column takes.
  static fromCalendarDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  // A Prisma `Decimal` (numeric(x,8)) -> exact decimal.
  static toAdjustment(row: InvestmentFixedIncomeAdjustment): FixedIncomeAdjustmentEntity {
    return {
      assetId: row.asset_id,
      date: InvestmentMapper.toCalendarDate(row.date),
      grossAmount: row.gross_amount,
      id: row.id,
    };
  }

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
      event: InvestmentMapper.toEvent(row),
      eventSuggestionId: row.event_suggestion_id,
      fees: row.fees.map((fee) => ({
        amount: fee.amount,
        description: fee.description,
        id: fee.id,
        kind: InvestmentFeeKind[fee.kind],
      })),
      feesTotal: row.fees_total ?? 0,
      fractionOfOperationId: row.fraction_of_operation_id,
      fxRate: row.fx_rate ? row.fx_rate.toFixed(6) : null,
      generateTransaction: row.generate_transaction,
      gross: row.gross ?? 0,
      id: row.id,
      netAmount: row.net_amount,
      quantity: row.quantity ? InvestmentMapper.toDecimal(row.quantity) : Decimal8.zero(),
      redemptionKind: row.redemption_kind
        ? InvestmentFixedIncomeRedemptionKind[row.redemption_kind]
        : null,
      total: row.total ?? 0,
      transactionId: row.transaction_id,
      type: InvestmentOperationType[row.type],
      unitPrice: row.unit_price ? InvestmentMapper.toDecimal(row.unit_price) : Decimal8.zero(),
    };
  }

  // Spec 108: the ratio or bonus fields of an event row, null for BUY/SELL.
  static toEvent(row: EventColumns): EventData | null {
    if (row.type === 'BONUS' && row.bonus_percent) {
      return {
        kind: 'BONUS',
        percent: InvestmentMapper.toDecimal(row.bonus_percent),
        unitCost: row.bonus_unit_cost ? InvestmentMapper.toDecimal(row.bonus_unit_cost) : null,
      };
    }

    if ((row.type === 'SPLIT' || row.type === 'REVERSE_SPLIT') && row.ratio_from && row.ratio_to) {
      return {
        kind: 'SPLIT',
        ratioFrom: InvestmentMapper.toDecimal(row.ratio_from),
        ratioTo: InvestmentMapper.toDecimal(row.ratio_to),
      };
    }

    return null;
  }

  // The calculator input from a raw operation row (datasource transactions select only these columns).
  static toPositionOperation(row: PositionColumns): PositionOperation {
    return {
      createdAt: row.created_at,
      date: InvestmentMapper.toCalendarDate(row.date),
      event: InvestmentMapper.toEvent(row) ?? undefined,
      fractionOfOperationId: row.fraction_of_operation_id,
      id: row.id,
      quantity: row.quantity ? InvestmentMapper.toDecimal(row.quantity) : Decimal8.zero(),
      total: row.total ?? 0,
      type: InvestmentOperationType[row.type],
    };
  }

  static toRate(row: InvestmentFixedIncomeRate): FixedIncomeRateEntity {
    return {
      annualRate: row.annual_rate ? row.annual_rate.toFixed(4) : null,
      assetId: row.asset_id,
      cdiPercent: row.cdi_percent ? row.cdi_percent.toFixed(4) : null,
      effectiveRate: row.effective_rate.toFixed(6),
      id: row.id,
      indexRate: row.index_rate ? row.index_rate.toFixed(4) : null,
      mode: InvestmentFixedIncomeRateMode[row.mode],
      spread: row.spread ? row.spread.toFixed(4) : null,
      startDate: InvestmentMapper.toCalendarDate(row.start_date),
    };
  }

  static toTerms(row: InvestmentFixedIncomeTerms): FixedIncomeTermsEntity {
    return {
      assetId: row.asset_id,
      liquidity: InvestmentFixedIncomeLiquidity[row.liquidity],
      liquidityDate: row.liquidity_date
        ? InvestmentMapper.toCalendarDate(row.liquidity_date)
        : null,
      maturityDate: InvestmentMapper.toCalendarDate(row.maturity_date),
      product: InvestmentFixedIncomeProduct[row.product],
      taxExempt: row.tax_exempt,
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
