export interface LotTaxes {
  iof: number;
  ir: number;
  net: number;
  yield: number;
}
export interface LotTaxesInput {
  days: number;
  gross: number;
  principal: number;
  taxExempt: boolean;
}

// Spec 105 FR 16: regressive IOF by calendar days 1-29 (percent); day 0 is 100% and day 30 on is 0.
const IOF_TABLE = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20,
  16, 13, 10, 6, 3,
];

export function iofRate(days: number): number {
  if (days <= 0) {
    return 1;
  }

  return days > IOF_TABLE.length ? 0 : IOF_TABLE[days - 1] / 100;
}
// FR 17: regressive income tax by calendar days.
export function irRate(days: number): number {
  if (days <= 180) {
    return 0.225;
  }
  if (days <= 360) {
    return 0.2;
  }

  return days <= 720 ? 0.175 : 0.15;
}
// FR 18: yield = max(0, gross - principal); IOF on the yield, IR on yield - IOF, both rounded half up to cents.
export function lotTaxes({ days, gross, principal, taxExempt }: LotTaxesInput): LotTaxes {
  const yieldAmount = Math.max(0, gross - principal);
  const iof = Math.round(yieldAmount * iofRate(days));
  const ir = taxExempt ? 0 : Math.round((yieldAmount - iof) * irRate(days));

  return { iof, ir, net: gross - iof - ir, yield: yieldAmount };
}
