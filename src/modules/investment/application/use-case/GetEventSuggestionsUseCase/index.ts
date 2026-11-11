import { Inject } from '@nestjs/common';

import {
  GetEventSuggestionsInput,
  GetEventSuggestionsSchema,
} from '@investment/application/dto/EventInput';
import { previewEvent } from '@investment/application/service/EventRules';
import { loadReadableAsset } from '@investment/application/service/IncomeRules';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { narrowOwners } from '@investment/domain/entity/OwnerAccess';
import { InvestmentAssetStatus, InvestmentOperationType } from '@investment/domain/enum';
import { ICorporateEventRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

export interface EventSuggestionsPage {
  items: EventSuggestionView[];
  nextCursor: null | string;
}
export interface EventSuggestionView {
  assetId: string;
  averagePriceAfter: null | string;
  averagePriceBefore: null | string;
  bonusPercent: null | string;
  bonusUnitCost: null | string;
  currency: string;
  // The data-com.
  date: string;
  fractionQuantity: string;
  id: string;
  // Position at the end of the data-com.
  quantity: string;
  quantityAfter: string;
  quantityBefore: string;
  ratioFrom: null | string;
  ratioTo: null | string;
  ticker: string;
  type: InvestmentOperationType;
}

function decimalOf(value: null | string): Decimal8 | null {
  return value === null ? null : Decimal8.parse(value);
}

// Spec 108 FR 26, 27, 33: the stored pending suggestions (no external call) with the preview of the event on the
// current operations; capped at 200 with a cursor.
export class GetEventSuggestionsUseCase implements UseCaseWithParams<
  GetEventSuggestionsInput,
  EventSuggestionsPage
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('ICorporateEventRepository') private readonly events: ICorporateEventRepository,
  ) {}

  private async assetsOf(
    input: ReturnType<typeof GetEventSuggestionsSchema.parse>,
  ): Promise<AssetDetail[]> {
    if (input.assetId) {
      return [await loadReadableAsset(this.investment, input.assetId, input.accessibleOwners)];
    }

    const narrowed = narrowOwners(input.accessibleOwners, input.ownerId).filter(
      (access) => !input.owner || input.owner === 'ALL' || access.owner === input.owner,
    );
    const rows = await this.investment.findAssetsByOwners(narrowed, InvestmentAssetStatus.ACTIVE);

    return rows.map((row) => ({ ...row, valuations: [] }));
  }

  async execute(params: GetEventSuggestionsInput): Promise<EventSuggestionsPage> {
    const input = validate(GetEventSuggestionsSchema, params);
    const assets = await this.assetsOf(input);
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const rows = await this.events.findPendingSuggestions(
      assets.map((asset) => asset.id),
      input.limit + 1,
      input.cursor,
    );
    const page = rows.slice(0, input.limit);
    const items: EventSuggestionView[] = [];

    for (const suggestion of page) {
      const asset = byId.get(suggestion.assetId);

      if (!asset) {
        continue;
      }

      const { event } = suggestion;
      const preview = previewEvent(asset.operations, asset.assetClass, {
        bonusPercent: decimalOf(event.bonusPercent),
        bonusUnitCost: decimalOf(event.bonusUnitCost),
        ratioFrom: decimalOf(event.ratioFrom),
        ratioTo: decimalOf(event.ratioTo),
        recordDate: event.recordDate,
        type: InvestmentOperationType[event.type],
      });

      if (!preview) {
        continue;
      }

      items.push({
        assetId: asset.id,
        averagePriceAfter: preview.averagePriceAfter,
        averagePriceBefore: preview.averagePriceBefore,
        bonusPercent: event.bonusPercent,
        bonusUnitCost: event.bonusUnitCost,
        currency: event.currency,
        date: event.recordDate,
        fractionQuantity: preview.fractionQuantity.toString(),
        id: suggestion.id,
        quantity: suggestion.quantity,
        quantityAfter: preview.quantityAfter.toString(),
        quantityBefore: preview.quantityBefore.toString(),
        ratioFrom: event.ratioFrom,
        ratioTo: event.ratioTo,
        ticker: asset.ticker ?? asset.name,
        type: InvestmentOperationType[event.type],
      });
    }

    return {
      items,
      nextCursor: rows.length > input.limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }
}
