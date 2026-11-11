import { InvestmentAssetClass } from '@investment/domain/enum';
import { Decimal8, roundDiv } from '@shared/infra/decimal';

const FACTOR = 10n ** 8n;

export interface BonusInput {
  cost: number;
  // "10" = one new share for every 10.
  percent: Decimal8;
  quantity: Decimal8;
  step: UnitStep;
  // Cost per new share in the asset currency; null = zero (spec 108 FR 5).
  unitCost: Decimal8 | null;
}
export interface EventStep {
  costAfter: number;
  costBefore: number;
  fractionCost: number;
  fractionQuantity: Decimal8;
  quantityAfter: Decimal8;
  quantityBefore: Decimal8;
}
export interface SplitInput {
  cost: number;
  quantity: Decimal8;
  ratioFrom: Decimal8;
  ratioTo: Decimal8;
  step: UnitStep;
}
export type UnitStep = 'DECIMAL' | 'WHOLE';

// Spec 108 FR 11: new shares = floor(quantity × percent / 100) to the unit step; the cost of the new shares
// (raw × unit cost) is added and the fraction takes its share out.
export function applyBonus(input: BonusInput): EventStep {
  const rawNew = Decimal8.fromScaled(
    (input.quantity.scaled * input.percent.scaled) / (100n * FACTOR),
  );
  const newShares = floorToStep(rawNew, input.step);
  const fraction = rawNew.minus(newShares);
  const unit = input.unitCost?.scaled ?? 0n;
  const addedCost = Number(roundDiv(rawNew.scaled * unit * 100n, FACTOR * FACTOR));
  const fractionCost = Number(roundDiv(fraction.scaled * unit * 100n, FACTOR * FACTOR));

  return {
    costAfter: input.cost + addedCost - fractionCost,
    costBefore: input.cost,
    fractionCost,
    fractionQuantity: fraction,
    quantityAfter: input.quantity.plus(newShares),
    quantityBefore: input.quantity,
  };
}

// Spec 108 FR 10: raw = quantity × to / from (floored to 8 places); the kept shares keep their cost and the
// fraction leaves with cost × fraction / raw.
export function applySplit(input: SplitInput): EventStep {
  const raw = Decimal8.fromScaled(
    (input.quantity.scaled * input.ratioTo.scaled) / input.ratioFrom.scaled,
  );
  const kept = floorToStep(raw, input.step);
  const fraction = raw.minus(kept);
  const fractionCost = raw.isZero()
    ? 0
    : Number(roundDiv(BigInt(input.cost) * fraction.scaled, raw.scaled));

  return {
    costAfter: input.cost - fractionCost,
    costBefore: input.cost,
    fractionCost,
    fractionQuantity: fraction,
    quantityAfter: kept,
    quantityBefore: input.quantity,
  };
}

// Spec 108 FR 9: B3 stocks and REITs hold whole units after an event (the B3 sells fractions in auction).
export function unitStepOf(assetClass: InvestmentAssetClass): UnitStep {
  return assetClass === InvestmentAssetClass.BR_STOCK || assetClass === InvestmentAssetClass.BR_REIT
    ? 'WHOLE'
    : 'DECIMAL';
}

function floorToStep(value: Decimal8, step: UnitStep): Decimal8 {
  return step === 'WHOLE' ? Decimal8.fromScaled((value.scaled / FACTOR) * FACTOR) : value;
}

// Spec 108 FR 16: gross / 100 / quantity as an 8-place decimal, for display only.
export function fractionUnitPrice(grossCents: number, quantity: Decimal8): Decimal8 {
  return Decimal8.fromScaled(roundDiv(BigInt(grossCents) * 10n ** 14n, quantity.scaled));
}
