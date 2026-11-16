import { UnitStep } from '@investment/domain/service/CorporateEventMath';
import { Decimal8, roundDiv } from '@shared/infra/decimal';

const FACTOR = 10n ** 8n;

export interface ConversionCash {
  // Cents.
  amount: number;
  // The value of one destination quota on the record date.
  referenceUnitValue: Decimal8;
}
export interface ConversionInput {
  cash?: ConversionCash | null;
  costOut: number;
  quantityOut: Decimal8;
  ratioFrom: Decimal8;
  ratioTo: Decimal8;
  step: UnitStep;
}
export interface ConversionResult {
  cashCost: number;
  costIn: number;
  fractionCost: number;
  fractionQuantity: Decimal8;
  quantityIn: Decimal8;
  raw: Decimal8;
  // The origin's realized result: the cash part minus the cost it took (0 without a cash part).
  realizedOut: number;
}

// Spec 112 FR 9-10, 15: the whole origin position becomes `raw = quantityOut × ratioTo / ratioFrom` destination quotas
// (floored to 8 places); the unit step keeps the whole quotas and the fraction leaves with its share of the cost.
export function computeConversion(input: ConversionInput): ConversionResult {
  const raw = Decimal8.fromScaled(
    (input.quantityOut.scaled * input.ratioTo.scaled) / input.ratioFrom.scaled,
  );
  const quantityIn = input.step === 'WHOLE' ? wholeUnits(raw) : raw;
  const fractionQuantity = raw.minus(quantityIn);
  const cashCost = cashCostOf(input.costOut, raw, input.cash ?? null);
  const costIn = input.costOut - cashCost;
  const fractionCost = raw.isZero()
    ? 0
    : Number(roundDiv(BigInt(costIn) * fractionQuantity.scaled, raw.scaled));

  return {
    cashCost,
    costIn,
    fractionCost,
    fractionQuantity,
    quantityIn,
    raw,
    realizedOut: input.cash ? input.cash.amount - cashCost : 0,
  };
}

// cash cost = cost × cash / (cash + raw × reference value), all in cents.
function cashCostOf(costOut: number, raw: Decimal8, cash: ConversionCash | null): number {
  if (!cash) {
    return 0;
  }

  const quotasValue = roundDiv(raw.scaled * cash.referenceUnitValue.scaled * 100n, FACTOR * FACTOR);
  const total = BigInt(cash.amount) + quotasValue;

  return Number(roundDiv(BigInt(costOut) * BigInt(cash.amount), total));
}
function wholeUnits(value: Decimal8): Decimal8 {
  return Decimal8.fromScaled((value.scaled / FACTOR) * FACTOR);
}
