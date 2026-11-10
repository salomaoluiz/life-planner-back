const DAY_MS = 86_400_000;
const FIXED_HOLIDAYS = [
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '11-20',
  '12-25',
];
const holidaysByYear = new Map<number, string[]>();

// Spec 105 FR 10: Monday to Friday that is not a Brazilian national holiday; `[from, to)`, no day-by-day loop.
export function businessDays(from: string, to: string): number {
  const start = dayNumber(from);
  const end = dayNumber(to);

  if (end <= start) {
    return 0;
  }

  let count = weekdaysBefore(end) - weekdaysBefore(start);

  for (let year = yearOf(from); year <= yearOf(to); year += 1) {
    for (const holiday of holidaysOf(year)) {
      const day = dayNumber(holiday);

      if (day >= start && day < end && isWeekday(day)) {
        count -= 1;
      }
    }
  }

  return count;
}
export function isBusinessDay(date: string): boolean {
  return isWeekday(dayNumber(date)) && !holidaysOf(yearOf(date)).includes(date);
}

function dayNumber(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / DAY_MS);
}
function easterOf(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function holidaysOf(year: number): string[] {
  const cached = holidaysByYear.get(year);

  if (cached) {
    return cached;
  }

  const easter = dayNumber(easterOf(year));
  const movable = [-48, -47, -2, 60].map((offset) =>
    new Date((easter + offset) * DAY_MS).toISOString().slice(0, 10),
  );
  const holidays = [...FIXED_HOLIDAYS.map((day) => `${year}-${day}`), ...movable];

  holidaysByYear.set(year, holidays);

  return holidays;
}
// 1970-01-01 is a Thursday: day 0 sits 3 days after a Monday.
function isWeekday(day: number): boolean {
  return (day + 3) % 7 < 5;
}
function weekdaysBefore(day: number): number {
  const shifted = day + 3;

  return Math.floor(shifted / 7) * 5 + Math.min(shifted % 7, 5) - 3;
}
function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}
