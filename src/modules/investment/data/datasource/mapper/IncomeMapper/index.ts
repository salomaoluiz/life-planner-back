import { InvestmentIncomeEvent } from '@db/client';
import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import {
  CategoryRow,
  IncomeRow,
  SuggestionRow,
} from '@investment/data/repository/datasource/IIncomeDatasource';
import {
  IncomeCategory,
  IncomeEntity,
  IncomeEventEntity,
  IncomeSuggestionEntity,
} from '@investment/domain/entity/IncomeEntity';
import {
  InvestmentAssetClass,
  InvestmentIncomeType,
  InvestmentSuggestionStatus,
} from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

type Numeric = { toFixed(places: number): string };

// Shortest decimal form ("300", "0.47") of a stored decimal(20,8).
export class IncomeMapper {
  static toCategory(row: CategoryRow): IncomeCategory {
    return {
      allScopes: row.all_scopes,
      archived: row.status === 'ARCHIVED',
      id: row.id,
      isIncome: row.type === 'INCOME',
      isSystem: row.system_key !== null,
      owner: row.owner ? OwnerType[row.owner] : null,
      ownerId: row.owner_id,
      scopes: row.scopes.map((scope) => ({
        owner: OwnerType[scope.owner],
        ownerId: scope.owner_id,
      })),
    };
  }

  static toEvent(row: InvestmentIncomeEvent): IncomeEventEntity {
    return {
      amountPerUnit: toDecimalString(row.amount_per_unit),
      currency: row.currency,
      exDate: InvestmentMapper.toCalendarDate(row.ex_date),
      id: row.id,
      market: QuoteMarket[row.market],
      paymentDate: row.payment_date ? InvestmentMapper.toCalendarDate(row.payment_date) : null,
      source: row.source,
      ticker: row.ticker,
      type: InvestmentIncomeType[row.type],
    };
  }

  static toIncome(row: IncomeRow): IncomeEntity {
    return {
      accountId: row.transaction?.account_id ?? null,
      amountPerUnit: row.amount_per_unit ? toDecimalString(row.amount_per_unit) : null,
      assetClass: InvestmentAssetClass[row.asset.asset_class],
      assetId: row.asset_id,
      categoryId: row.transaction?.category_id ?? null,
      createdAt: row.created_at,
      createdBy: row.created_by,
      currency: row.currency,
      exDate: row.ex_date ? InvestmentMapper.toCalendarDate(row.ex_date) : null,
      id: row.id,
      netAmount: row.net_amount,
      notes: row.notes,
      paid: row.transaction?.paid === true,
      paymentDate: InvestmentMapper.toCalendarDate(row.payment_date),
      quantity: row.quantity ? toDecimalString(row.quantity) : null,
      suggestionId: row.suggestion_id,
      transactionId: row.transaction_id,
      type: InvestmentIncomeType[row.type],
    };
  }

  static toSuggestion(row: SuggestionRow): IncomeSuggestionEntity {
    return {
      assetId: row.asset_id,
      event: IncomeMapper.toEvent(row.event),
      eventId: row.event_id,
      id: row.id,
      quantity: toDecimalString(row.quantity),
      status: InvestmentSuggestionStatus[row.status],
    };
  }
}

export function toDecimalString(value: Numeric): string {
  return Decimal8.parse(value.toFixed(8)).toString();
}
