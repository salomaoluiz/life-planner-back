import { AllocationLot, AllocationStep, planConsume } from '@stock/domain/service/LotAllocation';
import { ExpirationRules, lotStatus } from '@stock/domain/service/LotExpiration';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

export interface ConsumeWithChoicePlan {
  consumes: AllocationStep[];
  discards: AllocationStep[];
}
export type ExpiredLotsChoice = 'DISCARD_THEN_VALID' | 'EXPIRED_FIRST' | 'VALID_ONLY';

function total(lots: AllocationLot[]): number {
  return lots.reduce((sum, lot) => sum + toMilli(lot.quantity), 0);
}

// Spec 117 FR 14: which lots each expired-lot option touches. `undefined` = not enough quantity (409).
export function planConsumeWithChoice(
  lots: AllocationLot[],
  quantity: number,
  choice: ExpiredLotsChoice,
  rules: ExpirationRules,
  today: Date,
): ConsumeWithChoicePlan | undefined {
  const withStock = lots.filter((lot) => lot.quantity > 0);
  const expired = withStock.filter((lot) => lotStatus(lot, rules, today) === 'EXPIRED');
  const valid = withStock.filter((lot) => !expired.includes(lot));
  function consume(source: AllocationLot[], amount: number) {
    return planConsume(source, amount, rules.openedShelfLifeDays);
  }

  if (choice === 'EXPIRED_FIRST') {
    const fromExpired = Math.min(toMilli(quantity), total(expired));
    const first = consume(expired, fromExpired === 0 ? 0 : fromMilli(fromExpired)) ?? [];
    const rest = consume(valid, fromMilli(toMilli(quantity) - fromExpired));

    return rest && { consumes: [...first, ...rest], discards: [] };
  }

  if (choice === 'DISCARD_THEN_VALID' && valid.length === 0) {
    return {
      consumes: [],
      discards: expired.map((lot) => ({ lotId: lot.id, quantity: lot.quantity })),
    };
  }

  const consumes = consume(valid, quantity);

  if (!consumes) {
    return undefined;
  }

  return {
    consumes,
    discards:
      choice === 'DISCARD_THEN_VALID'
        ? expired.map((lot) => ({ lotId: lot.id, quantity: lot.quantity }))
        : [],
  };
}
