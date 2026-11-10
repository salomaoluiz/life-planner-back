import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PriceHistoryInput, PriceHistorySchema } from '@investment/application/dto/Quotes';
import { USD_BRL } from '@investment/application/service/QuoteContext';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository, IQuoteRepository } from '@investment/domain/repository';
import {
  buildPriceSeries,
  PricePointKind,
  rangeStart,
} from '@investment/domain/service/PriceSeries';
import { marketOfClass } from '@investment/domain/service/QuoteResolver';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface PriceHistoryView {
  currency: string;
  historyStartsAt: null | string;
  points: { date: string; fxRate: null | string; kind: PricePointKind; price: string }[];
}

function rateOn(
  rates: {
    fallback: null | string;
    history: { date: string; rate: string }[];
    seed: null | string;
  },
  date: string,
): null | string {
  let rate = rates.seed;

  for (const row of rates.history) {
    if (row.date > date) {
      break;
    }

    rate = row.rate;
  }

  return rate ?? rates.fallback;
}

// Spec 104 FR 16, 29, 30: daily closes plus the synthetic points before the first stored close; USD assets carry the
// exchange rate of each date (carried forward over gaps) so the app can draw the position in BRL.
@Injectable()
export class GetPriceHistoryUseCase implements UseCaseWithParams<
  PriceHistoryInput,
  PriceHistoryView
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investments: IInvestmentRepository,
    @Inject('IQuoteRepository') private readonly quotes: IQuoteRepository,
  ) {}

  async execute(params: PriceHistoryInput): Promise<PriceHistoryView> {
    const input = validate(PriceHistorySchema, params);
    const asset = await this.investments.findAssetById(input.id);
    if (!asset || !hasOwnerAccess(input.accessibleOwners, asset)) {
      throw new NotFoundException();
    }
    const now = new Date().toISOString().slice(0, 10);
    const market = marketOfClass(asset.assetClass);
    const closes =
      market && asset.ticker
        ? await this.quotes.findHistory(market, asset.ticker, rangeStart('ALL', now), now)
        : [];
    const series = buildPriceSeries({
      closes: closes.map((row) => ({ date: row.date, price: row.close.toString() })),
      now,
      operations: asset.operations.map((operation) => ({
        date: operation.date,
        price: operation.unitPrice.toString(),
      })),
      range: input.range,
      valuations: asset.valuations.map((valuation) => ({
        date: valuation.date,
        price: valuation.unitPrice.toString(),
      })),
    });
    const rates = await this.ratesFor(asset.currency, series.points[0]?.date ?? now, now);
    return {
      currency: asset.currency,
      historyStartsAt: series.historyStartsAt,
      points: series.points.map((point) => ({
        ...point,
        fxRate: rates ? rateOn(rates, point.date) : null,
      })),
    };
  }

  private async ratesFor(currency: string, from: string, to: string) {
    if (currency === 'BRL') {
      return null;
    }
    const [seed, history, latest] = await Promise.all([
      this.quotes.findFxOnOrBefore(USD_BRL, from),
      this.quotes.findFxHistory(USD_BRL, from, to),
      this.quotes.findFx(USD_BRL),
    ]);
    return { fallback: latest?.rate ?? null, history, seed: seed ?? null };
  }
}
