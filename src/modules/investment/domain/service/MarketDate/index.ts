import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

const TIME_ZONES: Record<QuoteMarket, string> = {
  [QuoteMarket.B3]: 'America/Sao_Paulo',
  [QuoteMarket.US]: 'America/New_York',
};
// First hour of trading in the market's own time zone (B3 and NYSE both open at 10:00 for this purpose).
const OPEN_HOUR = 10;

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
}
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();

  return day === 0 || day === 6;
}

// Spec 104 FR 21: the business day a fresh quote should belong to. Before the open of a weekday, or on a weekend,
// it is the previous weekday; there is no holiday calendar (a holiday makes the quote look one day stale at most).
export function lastBusinessDay(market: QuoteMarket, now: Date): string {
  const { date, hour } = localParts(now, TIME_ZONES[market]);
  let day = !isWeekend(date) && hour >= OPEN_HOUR ? date : addDays(date, -1);

  while (isWeekend(day)) {
    day = addDays(day, -1);
  }

  return day;
}

// Spec 104 FR 9: the history row of a quote is the calendar date of its market timestamp in the market's time zone.
export function marketDateOf(quotedAt: Date, market: QuoteMarket): string {
  return localParts(quotedAt, TIME_ZONES[market]).date;
}

function localParts(instant: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(instant);
  function get(type: string): string {
    return parts.find((part) => part.type === type)?.value ?? '';
  }

  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}
