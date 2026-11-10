import { InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

const RATE_SCALE = 1_000_000n;

export interface FxCost {
  // BRL per USD weighted by the USD cost of the remaining lots that have a rate; null with none.
  averageFxRate: null | string;
  // BUY operations that have no exchange rate (excluded from the BRL numbers).
  operationsWithoutFxRate: number;
}
export interface FxOperation {
  createdAt: Date;
  date: string;
  fxRate: null | string;
  id: string;
  total: number;
  type: InvestmentOperationType;
}
export interface FxResult {
  costBrl: number;
  marketValueBrl: number;
  resultBrl: number;
  resultBrlFromAsset: number;
  resultBrlFromFx: number;
  // Fraction of the BRL cost (0.3526 = 35.26%), 4 places.
  resultBrlPercent: null | number;
}

// Spec 104 FR 28: weighted average rate of the lots still held. A SELL removes the same fraction of the rated cost
// as the position removes of the whole cost (`costRemoved` comes from the position calculator).
export function averageFxCost(
  operations: FxOperation[],
  costRemovedBySell: Map<string, number>,
): FxCost {
  const sorted = [...operations].sort(compare);
  let cost = 0;
  let ratedUsd = 0n;
  let ratedBrl = 0n;
  let withoutRate = 0;

  for (const operation of sorted) {
    if (operation.type === InvestmentOperationType.BUY) {
      cost += operation.total;

      if (operation.fxRate === null) {
        withoutRate += 1;
        continue;
      }

      ratedUsd += BigInt(operation.total);
      ratedBrl += BigInt(operation.total) * rateScaled(operation.fxRate);
      continue;
    }

    const removed = costRemovedBySell.get(operation.id) ?? 0;

    if (cost > 0 && removed > 0) {
      const usdRemoved = divRound(ratedUsd * BigInt(removed), BigInt(cost));
      const brlRemoved = divRound(ratedBrl * BigInt(removed), BigInt(cost));

      ratedUsd -= usdRemoved;
      ratedBrl -= brlRemoved;
    }

    cost -= removed;
  }

  return {
    averageFxRate:
      ratedUsd > 0n ? Decimal8.fromScaled(divRound(ratedBrl * 100n, ratedUsd)).toString() : null,
    operationsWithoutFxRate: withoutRate,
  };
}

// Spec 104 FR 28: result in BRL split into the asset's move and the dollar's move; the two parts add up to the total
// (the rounding remainder goes to the dollar part). Money is integer cents of USD in, integer cents of BRL out.
export function splitFxResult(input: {
  averageFxRate: string;
  costUsd: number;
  currentFxRate: string;
  marketValueUsd: number;
}): FxResult {
  const average = rateScaled(input.averageFxRate);
  const current = rateScaled(input.currentFxRate);
  const costBrl = mulRate(input.costUsd, average);
  const marketValueBrl = mulRate(input.marketValueUsd, current);
  const resultBrl = marketValueBrl - costBrl;
  const resultBrlFromAsset = mulRate(input.marketValueUsd - input.costUsd, average);

  return {
    costBrl,
    marketValueBrl,
    resultBrl,
    resultBrlFromAsset,
    resultBrlFromFx: resultBrl - resultBrlFromAsset,
    resultBrlPercent: costBrl === 0 ? null : Math.round((resultBrl / costBrl) * 10000) / 10000,
  };
}

function compare(a: FxOperation, b: FxOperation): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }

  const byCreation = a.createdAt.getTime() - b.createdAt.getTime();

  return byCreation !== 0 ? byCreation : a.id.localeCompare(b.id);
}
// Integer division rounded half away from zero.
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (n * 2n + d) / (d * 2n);

  return negative ? -quotient : quotient;
}
function mulRate(cents: number, rate: bigint): number {
  return Number(divRound(BigInt(cents) * rate, RATE_SCALE));
}
function rateScaled(rate: string): bigint {
  const [integer, fraction = ''] = rate.split('.');

  return BigInt(integer) * RATE_SCALE + BigInt(fraction.padEnd(6, '0').slice(0, 6));
}
