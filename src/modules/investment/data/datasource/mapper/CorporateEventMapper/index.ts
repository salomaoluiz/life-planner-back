import { InvestmentCorporateEvent } from '@db/client';
import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { EventSuggestionRow } from '@investment/data/repository/datasource/ICorporateEventDatasource';
import {
  CorporateEventEntity,
  EventSuggestionEntity,
} from '@investment/domain/entity/CorporateEventEntity';
import { InvestmentCorporateEventType, InvestmentSuggestionStatus } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';

type Numeric = { toFixed(places: number): string };

// Shortest decimal form ("10", "0.5") of a stored decimal.
export class CorporateEventMapper {
  static toEvent(row: InvestmentCorporateEvent): CorporateEventEntity {
    return {
      bonusPercent: toDecimalString(row.bonus_percent),
      bonusUnitCost: toDecimalString(row.bonus_unit_cost),
      currency: row.currency,
      id: row.id,
      market: QuoteMarket[row.market],
      ratioFrom: toDecimalString(row.ratio_from),
      ratioTo: toDecimalString(row.ratio_to),
      recordDate: InvestmentMapper.toCalendarDate(row.record_date),
      ticker: row.ticker,
      type: InvestmentCorporateEventType[row.type],
    };
  }

  static toSuggestion(row: EventSuggestionRow): EventSuggestionEntity {
    return {
      assetId: row.asset_id,
      event: CorporateEventMapper.toEvent(row.event),
      eventId: row.event_id,
      id: row.id,
      quantity: toDecimalString(row.quantity) ?? '0',
      status: InvestmentSuggestionStatus[row.status],
    };
  }
}

function toDecimalString(value: null | Numeric): null | string {
  return value ? Decimal8.parse(value.toFixed(8)).toString() : null;
}
