import { InvestmentFixedIncomeRedemptionKind } from '@investment/domain/enum';
import { businessDays } from '@investment/domain/service/BusinessDayCalendar';
import { iofRate, irRate, lotTaxes } from '@investment/domain/service/FixedIncomeTaxes';

export interface CalcAdjustment {
  date: string;
  grossAmount: number;
}
export interface CalcInput {
  adjustments: CalcAdjustment[];
  lots: CalcLot[];
  // The valuation date (today, or the maturity for the projection).
  on: string;
  rates: CalcRate[];
  redemptions: CalcRedemption[];
  terms: CalcTerms;
}
export interface CalcLot {
  date: string;
  operationId: string;
  // Cents applied.
  principal: number;
}
export interface CalcRate {
  effectiveRate: number;
  startDate: string;
}
export interface CalcRedemption {
  date: string;
  kind: InvestmentFixedIncomeRedemptionKind;
  netAmount: number;
  operationId: string;
}
export interface CalcTerms {
  maturityDate: string;
  taxExempt: boolean;
}
export interface LotResult {
  date: string;
  days: number;
  gross: number;
  iof: number;
  iofRate: string;
  ir: number;
  irRate: string;
  net: number;
  operationId: string;
  principal: number;
  remainingPrincipal: number;
}
export interface RedemptionResult {
  gross: number;
  iof: number;
  ir: number;
  lotsUsed: { date: string; gross: number; operationId: string; principalUsed: number }[];
  principalUsed: number;
}
export interface RedemptionTooLarge {
  availableNet: number;
  date: string;
  operationId: string;
}
export interface TitleResult {
  error?: RedemptionTooLarge;
  lots: LotResult[];
  redemptions: Map<string, RedemptionResult>;
  remainingPrincipal: number;
  totals: Totals;
}
export interface Totals {
  gross: number;
  iof: number;
  ir: number;
  net: number;
}

type Event =
  | { adjustment: CalcAdjustment; date: string; order: 1 }
  | { date: string; lot: CalcLot; order: 0 }
  | { date: string; order: 2; redemption: CalcRedemption };
interface LotState {
  base: number;
  baseDate: string;
  date: string;
  operationId: string;
  principal: number;
  remaining: number;
}
interface Priced {
  days: number;
  gross: number;
  net: number;
  state: LotState;
  taxes: ReturnType<typeof lotTaxes>;
}

const BUSINESS_DAYS_PER_YEAR = 252;
const DAY_MS = 86_400_000;

// Spec 105 FR 11-12, 18, 20-21: replays contributions, statement adjustments and redemptions in date order.
export function calculateTitle(input: CalcInput): TitleResult {
  const states: LotState[] = [];
  const redemptions = new Map<string, RedemptionResult>();
  const rates = [...input.rates].sort((a, b) => a.startDate.localeCompare(b.startDate));
  function grossOf(state: LotState, on: string): number {
    return grossAt(state, on, rates, input.terms);
  }

  for (const event of eventsOf(input)) {
    if (event.order === 0) {
      states.push({
        base: event.lot.principal,
        baseDate: event.lot.date,
        date: event.lot.date,
        operationId: event.lot.operationId,
        principal: event.lot.principal,
        remaining: event.lot.principal,
      });
    } else if (event.order === 1) {
      applyAdjustment(states, event.adjustment, grossOf);
    } else {
      const done = redeem(states, event.redemption, input.terms, grossOf);

      if ('error' in done) {
        return { ...finish(states, input, rates, redemptions), error: done.error };
      }

      redemptions.set(event.redemption.operationId, done.result);
    }
  }

  return finish(states, input, rates, redemptions);
}
// FR 26: the projection keeps the latest rate until maturity.
export function projectAtMaturity(input: CalcInput): TitleResult {
  return calculateTitle({ ...input, on: input.terms.maturityDate });
}

function applyAdjustment(
  states: LotState[],
  adjustment: CalcAdjustment,
  grossOf: (state: LotState, on: string) => number,
): void {
  const open = states.filter((state) => state.remaining > 0);
  const computed = open.map((state) => grossOf(state, adjustment.date));
  const total = computed.reduce((sum, value) => sum + value, 0);

  if (open.length === 0 || total === 0) {
    return;
  }

  const scaled = computed.map((value) => Math.round((value * adjustment.grossAmount) / total));
  const difference = adjustment.grossAmount - scaled.reduce((sum, value) => sum + value, 0);
  const largest = computed.indexOf(Math.max(...computed));

  scaled[largest] += difference;
  open.forEach((state, index) => {
    state.base = scaled[index];
    state.baseDate = adjustment.date;
  });
}
function calendarDays(from: string, to: string): number {
  return Math.max(0, dayNumber(to) - dayNumber(from));
}
function dayNumber(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / DAY_MS);
}
function eventsOf(input: CalcInput): Event[] {
  const events: Event[] = [
    ...input.lots.map((lot) => ({ date: lot.date, lot, order: 0 as const })),
    ...input.adjustments.map((adjustment) => ({
      adjustment,
      date: adjustment.date,
      order: 1 as const,
    })),
    ...input.redemptions.map((redemption) => ({
      date: redemption.date,
      order: 2 as const,
      redemption,
    })),
  ];

  // Stable sort: same date and order keep the input order (operations come sorted by date, created_at, id).
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) =>
      a.event.date === b.event.date
        ? a.event.order - b.event.order || a.index - b.index
        : a.event.date.localeCompare(b.event.date),
    )
    .map(({ event }) => event);
}
function finish(
  states: LotState[],
  input: CalcInput,
  rates: CalcRate[],
  redemptions: Map<string, RedemptionResult>,
): TitleResult {
  const lots = states
    .filter((state) => state.remaining > 0 && state.date <= input.on)
    .map((state) => {
      const priced = price(state, input.on, rates, input.terms);

      return {
        date: state.date,
        days: priced.days,
        gross: priced.gross,
        iof: priced.taxes.iof,
        iofRate: String(iofRate(priced.days)),
        ir: priced.taxes.ir,
        irRate: input.terms.taxExempt ? '0' : String(irRate(priced.days)),
        net: priced.taxes.net,
        operationId: state.operationId,
        principal: state.principal,
        remainingPrincipal: state.remaining,
      };
    });

  return {
    lots,
    redemptions,
    remainingPrincipal: states.reduce((sum, state) => sum + state.remaining, 0),
    totals: {
      gross: sum(lots, 'gross'),
      iof: sum(lots, 'iof'),
      ir: sum(lots, 'ir'),
      net: sum(lots, 'net'),
    },
  };
}
// FR 11: base x product of (1 + rate)^(business days / 252) over the rate periods in [baseDate, on), capped at maturity.
function grossAt(state: LotState, on: string, rates: CalcRate[], terms: CalcTerms): number {
  const to = on < terms.maturityDate ? on : terms.maturityDate;
  let growth = 1;

  rates.forEach((rate, index) => {
    const next = rates[index + 1]?.startDate;
    const lo = state.baseDate > rate.startDate ? state.baseDate : rate.startDate;
    const hi = next && next < to ? next : to;

    if (hi > lo) {
      growth *= Math.pow(
        1 + rate.effectiveRate / 100,
        businessDays(lo, hi) / BUSINESS_DAYS_PER_YEAR,
      );
    }
  });

  return Math.round(state.base * growth);
}
function price(state: LotState, on: string, rates: CalcRate[], terms: CalcTerms): Priced {
  const gross = grossAt(state, on, rates, terms);
  const days = calendarDays(state.date, on);
  const taxes = lotTaxes({ days, gross, principal: state.remaining, taxExempt: terms.taxExempt });

  return { days, gross, net: taxes.net, state, taxes };
}
function redeem(
  states: LotState[],
  redemption: CalcRedemption,
  terms: CalcTerms,
  grossOf: (state: LotState, on: string) => number,
): { error: RedemptionTooLarge } | { result: RedemptionResult } {
  const priced = states
    .filter((state) => state.remaining > 0)
    .map((state) => {
      const gross = grossOf(state, redemption.date);
      const days = calendarDays(state.date, redemption.date);
      const taxes = lotTaxes({
        days,
        gross,
        principal: state.remaining,
        taxExempt: terms.taxExempt,
      });

      return { days, gross, net: taxes.net, state, taxes } as Priced;
    });
  const availableNet = priced.reduce((total, lot) => total + lot.net, 0);
  const tooLarge = {
    error: { availableNet, date: redemption.date, operationId: redemption.operationId },
  };

  if (priced.length === 0) {
    return tooLarge;
  }

  if (redemption.kind === InvestmentFixedIncomeRedemptionKind.TOTAL) {
    return { result: redeemTotal(priced, redemption) };
  }

  return redemption.netAmount > availableNet
    ? tooLarge
    : { result: redeemPartial(priced, redemption.netAmount) };
}
function redeemPartial(priced: Priced[], netAmount: number): RedemptionResult {
  const result: RedemptionResult = { gross: 0, iof: 0, ir: 0, lotsUsed: [], principalUsed: 0 };
  let toCover = netAmount;

  for (const lot of priced) {
    if (toCover <= 0) {
      break;
    }

    const fraction = Math.min(1, toCover / lot.net);
    const used = fraction === 1 ? lot.state.remaining : Math.round(lot.state.remaining * fraction);
    const gross = fraction === 1 ? lot.gross : Math.round(lot.gross * fraction);

    result.gross += gross;
    result.iof += fraction === 1 ? lot.taxes.iof : Math.round(lot.taxes.iof * fraction);
    result.ir += fraction === 1 ? lot.taxes.ir : Math.round(lot.taxes.ir * fraction);
    result.principalUsed += used;
    result.lotsUsed.push({
      date: lot.state.date,
      gross,
      operationId: lot.state.operationId,
      principalUsed: used,
    });
    toCover -= Math.min(toCover, lot.net);

    const left = lot.state.remaining - used;

    lot.state.base =
      lot.state.remaining === 0 ? 0 : Math.round((lot.state.base * left) / lot.state.remaining);
    lot.state.remaining = left;
  }

  // Rounding lands on the IR so that gross - IOF - IR is exactly what the owner typed.
  result.ir = Math.max(0, result.gross - result.iof - netAmount);
  result.gross = netAmount + result.iof + result.ir;

  return result;
}
function redeemTotal(priced: Priced[], redemption: CalcRedemption): RedemptionResult {
  const curveGross = priced.reduce((total, lot) => total + lot.gross, 0);
  const iofEstimate = priced.reduce((total, lot) => total + lot.taxes.iof, 0);
  const irEstimate = priced.reduce((total, lot) => total + lot.taxes.ir, 0);
  const gross = Math.max(curveGross, redemption.netAmount);
  const withheld = gross - redemption.netAmount;
  const iof =
    iofEstimate + irEstimate === 0
      ? 0
      : Math.round((withheld * iofEstimate) / (iofEstimate + irEstimate));
  const principalUsed = priced.reduce((total, lot) => total + lot.state.remaining, 0);
  const lotsUsed = priced.map((lot) => ({
    date: lot.state.date,
    gross: lot.gross,
    operationId: lot.state.operationId,
    principalUsed: lot.state.remaining,
  }));

  for (const lot of priced) {
    lot.state.base = 0;
    lot.state.remaining = 0;
  }

  return { gross, iof, ir: withheld - iof, lotsUsed, principalUsed };
}
function sum<T extends object>(rows: T[], key: keyof T): number {
  return rows.reduce((total, row) => total + (row[key] as number), 0);
}
