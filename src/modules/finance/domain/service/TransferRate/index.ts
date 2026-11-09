// Spec 098 FR 3: the API stores amounts only; the rate is derived. `base` says which side is the unit:
// `IN` reads "1 <currency in> = value <currency out>", `OUT` the other way, so `value` is always at least 1.
export interface TransferRateValue {
  base: 'IN' | 'OUT';
  value: number;
}

const RATE_DECIMALS = 4;

function round(value: number): number {
  const factor = 10 ** RATE_DECIMALS;

  return Math.round(value * factor) / factor;
}

export function computeRate(amountOut: number, amountIn: null | number): null | TransferRateValue {
  if (amountIn === null || amountIn <= 0 || amountOut <= 0) {
    return null;
  }

  return amountOut >= amountIn
    ? { base: 'IN', value: round(amountOut / amountIn) }
    : { base: 'OUT', value: round(amountIn / amountOut) };
}

// A typed rate in the "1 IN = rate OUT" direction fills the amount in (cents, rounded to the nearest cent).
export function amountInFromRate(amountOut: number, rate: number): null | number {
  if (rate <= 0 || amountOut <= 0) {
    return null;
  }

  return Math.round(amountOut / rate);
}
