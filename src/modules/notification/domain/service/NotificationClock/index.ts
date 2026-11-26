export interface ClockPreferences {
  lastSummaryOn: null | string;
  quietEndMinute: number;
  quietStartMinute: number;
  summaryMinute: number;
  timeZone: string;
}
export interface LocalMoment {
  // YYYY-MM-DD in the user's time zone.
  date: string;
  // Minutes since local midnight, 0-1439.
  minute: number;
}

// FR 9: a summary is never sent in the last minute of the day.
const LAST_SUMMARY_MINUTE = 1438;
const DAY_MS = 86_400_000;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });

    return true;
  } catch {
    return false;
  }
}
export function localMoment(now: Date, timeZone: string): LocalMoment {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// FR 9: local time >= summaryTime, no summary yet on the local date, and before 23:59.
export function isDueForSummary(preferences: ClockPreferences, now: Date): boolean {
  const local = localMoment(now, preferences.timeZone);

  return (
    local.minute >= preferences.summaryMinute &&
    local.minute <= LAST_SUMMARY_MINUTE &&
    (preferences.lastSummaryOn === null || preferences.lastSummaryOn < local.date)
  );
}

// FR 14-15: urgent notices only once today's summary exists (or was empty).
export function isDueForUrgent(preferences: ClockPreferences, now: Date): boolean {
  return preferences.lastSummaryOn === localMoment(now, preferences.timeZone).date;
}

// FR 16: start and end may cross midnight; equal values mean no quiet hours.
export function addDaysToDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
export function isInsideQuietHours(
  minute: number,
  startMinute: number,
  endMinute: number,
): boolean {
  if (startMinute === endMinute) {
    return false;
  }

  return startMinute < endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute || minute < endMinute;
}

function offsetMs(at: Date, timeZone: string): number {
  const local = localMoment(at, timeZone);
  const asUtc = Date.parse(`${local.date}T00:00:00Z`) + local.minute * 60_000;

  return asUtc - Math.floor(at.getTime() / 60_000) * 60_000;
}

// The UTC instant at which `minute` happens on the local `date`.
export function instantOf(date: string, minute: number, timeZone: string): Date {
  const guess = Date.parse(`${date}T00:00:00Z`) + minute * 60_000;
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);

  return new Date(second);
}

// FR 16: when the push deliveries of a notice created `now` may leave (now itself outside quiet hours).
export function pushNotBefore(preferences: ClockPreferences, now: Date): Date {
  const local = localMoment(now, preferences.timeZone);

  if (!isInsideQuietHours(local.minute, preferences.quietStartMinute, preferences.quietEndMinute)) {
    return now;
  }

  // Before midnight the window ends tomorrow; after midnight (or in a same-day window) it ends today.
  const endsTomorrow =
    preferences.quietStartMinute > preferences.quietEndMinute &&
    local.minute >= preferences.quietStartMinute;

  return instantOf(
    endsTomorrow ? addDaysToDate(local.date, 1) : local.date,
    preferences.quietEndMinute,
    preferences.timeZone,
  );
}

// 'HH:mm' <-> minutes since midnight.
export function minuteOfTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);

  return hours * 60 + minutes;
}
export function timeOfMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
